import type { BellId } from '../session/types.js';
import { type AmbientId, type Bed, createSampleBed, createSynthBed } from './beds.js';
import { bellSpacing, strikeBell } from './bells.js';
import { impulseResponse } from './noise.js';

/**
 * Optional recorded sounds, written by scripts/fetch-sounds.mjs.
 * Anything missing falls back to the synthesizer.
 */
interface SoundManifest {
  ambient?: Partial<Record<AmbientId, { file: string; gain?: number }>>;
  bells?: Partial<Record<BellId, { file: string; gain?: number }>>;
}

const XFADE = 3;

/**
 * Ambient bed + bells over Web Audio.
 *
 * Signal flow:  bed ─▶ ambientBus ─┐
 *               bell ─▶ bellBus ─┬─┼─▶ master ─▶ destination
 *                                └─▶ reverb ─┘
 *
 * The AudioContext can only start after a user gesture, so call `unlock()` from a click.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private ambientBus!: GainNode;
  private bellBus!: GainNode;
  private bellDry!: GainNode;
  private bellReverb!: ConvolverNode;
  /** Bumped by stopAll() so bells still loading don't play afterwards. */
  private gen = 0;
  private bed: Bed | null = null;
  private bedId: AmbientId = 'none';
  private wantedBed: AmbientId = 'none';
  private timer = 0;
  private manifest: SoundManifest = {};
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private ambientLevel = 0.5;
  private bellLevel = 0.8;

  constructor(private readonly baseUrl: string) {}

  get unlocked() {
    return this.ctx?.state === 'running';
  }

  /** Short soft click, used by the hub dial at each detent. */
  tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    o.type = 'sine';
    o.frequency.value = 1500;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.06);
  }

  async unlock(): Promise<void> {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: 'playback' });
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 1;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 3;
      this.master.connect(comp).connect(ctx.destination);

      this.ambientBus = ctx.createGain();
      this.ambientBus.gain.value = this.ambientLevel;
      this.ambientBus.connect(this.master);

      this.bellBus = ctx.createGain();
      this.bellBus.gain.value = this.bellLevel;
      const dry = ctx.createGain();
      dry.gain.value = 0.8;
      const reverb = ctx.createConvolver();
      reverb.buffer = impulseResponse(ctx);
      const wet = ctx.createGain();
      wet.gain.value = 0.35;
      this.bellDry = dry;
      this.bellReverb = reverb;
      this.bellBus.connect(dry).connect(this.master);
      this.bellBus.connect(reverb).connect(wet).connect(this.master);

      this.timer = window.setInterval(() => this.pump(), 100);
      this.loadManifest();
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
    if (this.wantedBed !== this.bedId) this.setAmbient(this.wantedBed);
  }

  /** Lookahead scheduling for bed events (birds, drops, waves). */
  private pump() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.bed?.schedule(this.ctx.currentTime + 1.5);
  }

  private async loadManifest() {
    try {
      const res = await fetch(`${this.baseUrl}audio/manifest.json`);
      if (res.ok) this.manifest = await res.json();
    } catch {
      /* no recorded sounds — synth only */
    }
  }

  private loadBuffer(file: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(file);
    if (!p) {
      p = fetch(`${this.baseUrl}${file}`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then((b) => this.ctx!.decodeAudioData(b))
        .catch((e) => {
          console.warn(`[audio] could not load ${file}, using synth`, e);
          return null;
        });
      this.buffers.set(file, p);
    }
    return p;
  }

  async setAmbient(id: AmbientId) {
    this.wantedBed = id;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || id === this.bedId) return;
    this.bedId = id;

    const old = this.bed;
    this.bed = null;
    const now = ctx.currentTime;
    if (old) {
      old.output.gain.setTargetAtTime(0, now, XFADE / 3);
      old.stop(now + XFADE * 1.5);
    }
    if (id === 'none') return;

    const rec = this.manifest.ambient?.[id];
    const buffer = rec ? await this.loadBuffer(rec.file) : null;
    if (this.bedId !== id) return; // changed while loading
    const bed = buffer ? createSampleBed(ctx, buffer, rec?.gain ?? 1) : createSynthBed(ctx, id);
    if (!bed) return;
    bed.output.gain.setValueAtTime(0, ctx.currentTime);
    bed.output.gain.setTargetAtTime(1, ctx.currentTime, XFADE / 3);
    bed.output.connect(this.ambientBus);
    this.bed = bed;
  }

  /** Strike a bell `count` times. Returns the time of the last strike. */
  async bell(id: BellId, count = 1, delay = 0) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const rec = this.manifest.bells?.[id];
    const gen = this.gen;
    const buffer = rec ? await this.loadBuffer(rec.file) : null;
    if (gen !== this.gen) return; // stopAll() while loading
    const spacing = bellSpacing(id);
    const t0 = ctx.currentTime + 0.05 + delay;
    for (let i = 0; i < count; i++) {
      const when = t0 + i * spacing;
      // The last of a series is struck a little softer, like a teacher closing a sit.
      const vel = count > 1 && i === count - 1 ? 0.8 : 1;
      if (buffer) {
        const s = ctx.createBufferSource();
        s.buffer = buffer;
        const g = ctx.createGain();
        g.gain.value = (rec?.gain ?? 1) * vel;
        s.connect(g).connect(this.bellBus);
        s.start(when);
      } else {
        strikeBell(ctx, this.bellBus, id, when, vel);
      }
    }
  }

  setAmbientVolume(v: number) {
    this.ambientLevel = v;
    if (this.ctx) this.ambientBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  setBellVolume(v: number) {
    this.bellLevel = v;
    if (this.ctx) this.bellBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  /**
   * Silence everything now: drop the ambient bed and cut off any bells already
   * scheduled. Bells and the old bed hang off buses that get swapped out, so
   * their nodes die with them. The dial tick still works (it goes to master).
   */
  stopAll() {
    this.gen++;
    this.wantedBed = 'none';
    this.bedId = 'none';
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const old = this.bed;
    this.bed = null;
    if (old) {
      old.stop(now + 0.05);
      old.output.disconnect();
    }
    this.ambientBus.disconnect();
    this.ambientBus = ctx.createGain();
    this.ambientBus.gain.value = this.ambientLevel;
    this.ambientBus.connect(this.master);

    // Bell bus feeds a dry gain and a reverb send; rewire the new bus to both.
    this.bellBus.disconnect();
    this.bellBus = ctx.createGain();
    this.bellBus.gain.value = this.bellLevel;
    this.bellBus.connect(this.bellDry);
    this.bellBus.connect(this.bellReverb);

    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(1, now);
  }

  /** Fade everything (used for pause / end of session). */
  fadeMaster(to: number, seconds: number) {
    if (!this.ctx) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(to, this.ctx.currentTime, Math.max(0.01, seconds / 3));
  }

  dispose() {
    clearInterval(this.timer);
    this.ctx?.close();
  }
}
