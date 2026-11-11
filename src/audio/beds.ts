import { noiseSource } from './noise.js';

export type AmbientId = 'rain' | 'forest' | 'waves' | 'stream' | 'night' | 'none';
export const AMBIENTS: AmbientId[] = ['rain', 'forest', 'waves', 'stream', 'night', 'none'];

/** A continuous sound layer. `schedule` is called ~10×/s with a lookahead horizon. */
export interface Bed {
  output: GainNode;
  schedule(until: number): void;
  stop(at: number): void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function filter(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function gain(ctx: BaseAudioContext, v: number) {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

function panner(ctx: BaseAudioContext, pan: number) {
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  return p;
}

/** Build a bed out of looping noise layers plus optional event scheduler. */
function makeBed(
  ctx: AudioContext,
  layers: (out: GainNode, sources: AudioScheduledSourceNode[]) => void,
  events?: (out: GainNode, from: number, until: number) => number,
): Bed {
  const output = gain(ctx, 1);
  const sources: AudioScheduledSourceNode[] = [];
  layers(output, sources);
  const t0 = ctx.currentTime;
  for (const s of sources) {
    if (s instanceof AudioBufferSourceNode) s.start(t0, rand(0, s.buffer!.duration));
    else s.start(t0);
  }
  let scheduledTo = ctx.currentTime;
  return {
    output,
    schedule(until) {
      if (events && until > scheduledTo) scheduledTo = events(output, scheduledTo, until);
    },
    stop(at) {
      for (const s of sources) s.stop(at);
      setTimeout(() => output.disconnect(), (at - ctx.currentTime + 0.5) * 1000);
    },
  };
}

/**
 * Smooth random modulation (±depth around the param's value) at roughly `rate` Hz.
 * Implemented as a looping buffer of cosine-interpolated random points.
 */
function wobble(
  ctx: BaseAudioContext,
  param: AudioParam,
  depth: number,
  rate: number,
  sources: AudioScheduledSourceNode[],
) {
  // Control-rate signal: 30 s at 3 kHz (the lowest rate createBuffer allows).
  const buf = ctx.createBuffer(1, 3000 * 30, 3000);
  const d = buf.getChannelData(0);
  const step = Math.max(2, Math.floor(buf.sampleRate / rate));
  const points = Math.ceil(d.length / step) + 1;
  const ys = Array.from({ length: points }, () => Math.random() * 2 - 1);
  ys[points - 1] = ys[0]; // seamless loop
  for (let i = 0; i < d.length; i++) {
    const k = Math.floor(i / step);
    const f = (1 - Math.cos(((i % step) / step) * Math.PI)) / 2;
    d[i] = ys[k] * (1 - f) + ys[Math.min(k + 1, points - 1)] * f;
  }
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  s.connect(gain(ctx, depth)).connect(param);
  sources.push(s);
}

function rain(ctx: AudioContext): Bed {
  return makeBed(
    ctx,
    (out, src) => {
      const hiss = noiseSource(ctx, 'pink');
      hiss.connect(filter(ctx, 'highpass', 500)).connect(filter(ctx, 'lowpass', 6500)).connect(gain(ctx, 0.5)).connect(out);
      const body = noiseSource(ctx, 'brown');
      body.connect(filter(ctx, 'lowpass', 350)).connect(gain(ctx, 0.35)).connect(out);
      const patter = noiseSource(ctx, 'white');
      const bp = filter(ctx, 'bandpass', 2500, 0.8);
      const pg = gain(ctx, 0.08);
      wobble(ctx, pg.gain, 0.05, 3, src);
      patter.connect(bp).connect(pg).connect(out);
      src.push(hiss, body, patter);
    },
    (out, from, until) => {
      // Individual close drops.
      let t = from;
      while (t < until) {
        t += rand(0.02, 0.25);
        const len = Math.floor(ctx.sampleRate * 0.012);
        const b = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
        const s = ctx.createBufferSource();
        s.buffer = b;
        const f = filter(ctx, 'bandpass', rand(1800, 6000), rand(2, 6));
        const g = gain(ctx, rand(0.02, 0.12));
        s.connect(f).connect(g).connect(panner(ctx, rand(-0.9, 0.9))).connect(out);
        s.start(t);
      }
      return t;
    },
  );
}

function forest(ctx: AudioContext): Bed {
  return makeBed(
    ctx,
    (out, src) => {
      const wind = noiseSource(ctx, 'brown');
      const lp = filter(ctx, 'lowpass', 420);
      wobble(ctx, lp.frequency, 180, 0.15, src);
      const wg = gain(ctx, 0.45);
      wobble(ctx, wg.gain, 0.2, 0.1, src);
      wind.connect(lp).connect(wg).connect(out);
      const leaves = noiseSource(ctx, 'pink');
      const lg = gain(ctx, 0.05);
      wobble(ctx, lg.gain, 0.04, 0.2, src);
      leaves.connect(filter(ctx, 'highpass', 2200)).connect(lg).connect(out);
      src.push(wind, leaves);
    },
    (out, from, until) => {
      // Distant birds: short phrases of 2–6 chirps, every 4–14 s.
      let t = from;
      while (t < until) {
        t += rand(4, 14);
        const pan = panner(ctx, rand(-0.9, 0.9));
        const g = gain(ctx, rand(0.015, 0.04));
        g.connect(pan).connect(out);
        const base = rand(2400, 4200);
        const n = Math.floor(rand(2, 7));
        const kind = Math.random();
        for (let i = 0; i < n; i++) {
          const ct = t + i * rand(0.11, 0.2);
          const dur = rand(0.05, 0.12);
          const o = ctx.createOscillator();
          const e = ctx.createGain();
          const f0 = base * rand(0.95, 1.05);
          if (kind < 0.5) {
            o.frequency.setValueAtTime(f0, ct);
            o.frequency.exponentialRampToValueAtTime(f0 * 1.35, ct + dur);
          } else {
            o.frequency.setValueAtTime(f0 * 1.3, ct);
            o.frequency.exponentialRampToValueAtTime(f0 * 0.85, ct + dur);
          }
          e.gain.setValueAtTime(0, ct);
          e.gain.linearRampToValueAtTime(1, ct + 0.01);
          e.gain.exponentialRampToValueAtTime(0.001, ct + dur);
          o.connect(e).connect(g);
          o.start(ct);
          o.stop(ct + dur + 0.02);
        }
      }
      return t;
    },
  );
}

function waves(ctx: AudioContext): Bed {
  let surf!: GainNode, surfLp!: BiquadFilterNode, foam!: GainNode;
  return makeBed(
    ctx,
    (out, src) => {
      const n = noiseSource(ctx, 'brown');
      surfLp = filter(ctx, 'lowpass', 400);
      surf = gain(ctx, 0.12);
      n.connect(surfLp).connect(surf).connect(out);
      const f = noiseSource(ctx, 'pink');
      foam = gain(ctx, 0.0);
      f.connect(filter(ctx, 'highpass', 1500)).connect(foam).connect(out);
      src.push(n, f);
    },
    (_out, from, until) => {
      // One wave = rise, crash, long wash back.
      let t = from;
      while (t < until) {
        const period = rand(7, 12);
        const peak = rand(0.55, 0.9);
        const rise = period * 0.35;
        surf.gain.setTargetAtTime(peak, t, rise / 3);
        surfLp.frequency.setTargetAtTime(rand(1200, 1900), t, rise / 3);
        foam.gain.setTargetAtTime(peak * 0.12, t + rise * 0.8, 0.4);
        surf.gain.setTargetAtTime(0.12, t + rise, (period - rise) / 3.5);
        surfLp.frequency.setTargetAtTime(380, t + rise, (period - rise) / 3);
        foam.gain.setTargetAtTime(0, t + rise + 0.6, (period - rise) / 4);
        t += period;
      }
      return t;
    },
  );
}

function stream(ctx: AudioContext): Bed {
  return makeBed(ctx, (out, src) => {
    for (const [f, q, v, rate] of [
      [350, 1.5, 0.25, 2],
      [900, 2, 0.18, 4],
      [1800, 2.5, 0.12, 6],
      [3600, 3, 0.06, 8],
    ] as const) {
      const n = noiseSource(ctx, 'white');
      const bp = filter(ctx, 'bandpass', f, q);
      wobble(ctx, bp.frequency, f * 0.25, rate, src);
      const g = gain(ctx, v);
      wobble(ctx, g.gain, v * 0.6, rate, src);
      n.connect(bp).connect(g).connect(panner(ctx, rand(-0.6, 0.6))).connect(out);
      src.push(n);
    }
  });
}

function night(ctx: AudioContext): Bed {
  return makeBed(
    ctx,
    (out, src) => {
      const air = noiseSource(ctx, 'brown');
      const g = gain(ctx, 0.12);
      wobble(ctx, g.gain, 0.05, 0.08, src);
      air.connect(filter(ctx, 'lowpass', 300)).connect(g).connect(out);
      src.push(air);
    },
    (out, from, until) => {
      // Two crickets at different distances, chirping in groups of three pulses.
      let t = from;
      while (t < until) {
        for (const [freq, pan, vol, jitter] of [
          [4300, -0.6, 0.02, 0.0],
          [4750, 0.5, 0.012, 0.15],
        ] as const) {
          if (Math.random() < 0.15) continue;
          const start = t + jitter + rand(0, 0.05);
          const o = ctx.createOscillator();
          o.frequency.value = freq;
          const e = ctx.createGain();
          e.gain.value = 0;
          for (let k = 0; k < 3; k++) {
            const p = start + k * 0.045;
            e.gain.setValueAtTime(0, p);
            e.gain.linearRampToValueAtTime(vol, p + 0.006);
            e.gain.linearRampToValueAtTime(0, p + 0.025);
          }
          o.connect(e).connect(panner(ctx, pan)).connect(out);
          o.start(start);
          o.stop(start + 0.2);
        }
        t += rand(0.55, 0.8);
      }
      return t;
    },
  );
}

const BUILDERS: Record<Exclude<AmbientId, 'none'>, (ctx: AudioContext) => Bed> = {
  rain,
  forest,
  waves,
  stream,
  night,
};

export function createSynthBed(ctx: AudioContext, id: AmbientId): Bed | null {
  return id === 'none' ? null : BUILDERS[id](ctx);
}

const seamlessCache = new WeakMap<AudioBuffer, AudioBuffer>();

/**
 * Field recordings aren't made to loop. Fold the last `fade` seconds over the start
 * with an equal-power cross-fade so the loop point is inaudible.
 */
export function seamless(ctx: BaseAudioContext, buf: AudioBuffer, fade = 2.5): AudioBuffer {
  const hit = seamlessCache.get(buf);
  if (hit) return hit;
  const f = Math.min(Math.floor(fade * buf.sampleRate), Math.floor(buf.length / 3));
  const len = buf.length - f;
  const out = ctx.createBuffer(buf.numberOfChannels, len, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const src = buf.getChannelData(ch);
    const dst = out.getChannelData(ch);
    dst.set(src.subarray(0, len));
    for (let i = 0; i < f; i++) {
      const a = i / f;
      dst[i] = src[i] * Math.sin((a * Math.PI) / 2) + src[len + i] * Math.cos((a * Math.PI) / 2);
    }
  }
  seamlessCache.set(buf, out);
  return out;
}

/** A bed that loops a recorded file (from public/audio, see scripts/fetch-sounds.mjs). */
export function createSampleBed(ctx: AudioContext, buffer: AudioBuffer, level = 1): Bed {
  return makeBed(ctx, (out, src) => {
    const s = ctx.createBufferSource();
    s.buffer = seamless(ctx, buffer);
    s.loop = true;
    s.connect(gain(ctx, level)).connect(out);
    src.push(s);
  });
}
