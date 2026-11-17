import { createSystem } from '@iwsdk/core';
import { store } from '../app.js';
import { gpuTextureBytes, largestTextures, MiB, resetPeak } from '../perf/gpu-memory.js';
import { PLACES } from '../state.js';

/** Enabled in dev, or in any build with `?perf` (or `?soak`) in the URL, e.g. on a Quest. */
export function perfEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  const q = new URLSearchParams(location.search);
  return q.has('perf') || q.has('soak');
}

export interface SoakResult {
  switches: number;
  afterFirstMiB: number;
  finalMiB: number;
  peakMiB: number;
  growth: number;
  worstFrameMs: number;
  /** Frames over 50 ms, counted only while a place was loading or fading. */
  longFrames: number;
  textures: number;
  /** Largest live textures (MiB) at the end. */
  largest: number[];
  pass: boolean;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Logs GPU texture memory and frame times, and runs a "soak": it switches through every
 * place a few times and reports whether memory returns to its level after the first switch.
 *
 * Start a soak with Shift+P, with `?soak` in the URL, or with `perf.soak()` in the console.
 * The result is logged as `[perf] soak {...}` and kept in `window.perf.last`.
 */
export class PerfProbeSystem extends createSystem({}) {
  private last = 0;
  private worst = 0;
  private longFrames = 0;
  private running = false;

  init(): void {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' && e.shiftKey) void this.soak();
    };
    window.addEventListener('keydown', onKey);
    this.cleanupFuncs.push(() => window.removeEventListener('keydown', onKey));
    Object.assign(window, {
      perf: {
        soak: (rounds?: number) => this.soak(rounds),
        report: () => this.report(),
        last: null as SoakResult | null,
      },
    });
    if (new URLSearchParams(location.search).has('soak')) {
      const unsub = store.subscribe((s) => {
        if (s.shownPlace && !s.loading) {
          unsub();
          setTimeout(() => void this.soak(), 1500);
        }
      });
    }
  }

  update(): void {
    const now = performance.now();
    if (this.last) {
      const dt = now - this.last;
      if (dt > this.worst) this.worst = dt;
      if (dt > 50 && this.running) this.longFrames++;
    }
    this.last = now;
  }

  report() {
    const g = gpuTextureBytes();
    const info = this.renderer.info.memory;
    const r = {
      gpuMiB: r1(g.total / MiB),
      peakMiB: r1(g.peak / MiB),
      glTextures: g.textures,
      threeTextures: info.textures,
      geometries: info.geometries,
      worstFrameMs: Math.round(this.worst),
    };
    console.info('[perf]', JSON.stringify(r));
    return r;
  }

  private waitShown(id: string): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        const s = store.get();
        return s.shownPlace === id && !s.loading;
      };
      if (check()) return resolve();
      const unsub = store.subscribe(() => {
        if (check()) {
          unsub();
          resolve();
        }
      });
    });
  }

  async soak(rounds = 3): Promise<SoakResult | null> {
    if (this.running) return null;
    this.running = true;
    this.longFrames = 0;
    resetPeak();
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const start = store.get().prefs.place;
    const order = PLACES.map((p) => p.id).filter((id) => id !== start);
    order.push(start);
    let afterFirst = 0;
    let worst = 0;
    let n = 0;
    for (let round = 0; round < rounds; round++) {
      for (const id of order) {
        this.worst = 0;
        store.setPrefs({ place: id });
        await this.waitShown(id);
        await sleep(2200); // let the fade-in finish and any upgrade settle
        worst = Math.max(worst, this.worst);
        n++;
        const g = gpuTextureBytes();
        if (n === 1) afterFirst = g.total;
        console.info(`[perf] switch ${n} → ${id}: ${r1(g.total / MiB)} MiB, worst frame ${Math.round(this.worst)} ms`);
      }
    }
    const g = gpuTextureBytes();
    const growth = afterFirst ? g.total / afterFirst : 1;
    const result: SoakResult = {
      switches: n,
      afterFirstMiB: r1(afterFirst / MiB),
      finalMiB: r1(g.total / MiB),
      peakMiB: r1(g.peak / MiB),
      growth: Math.round(growth * 100) / 100,
      worstFrameMs: Math.round(worst),
      longFrames: this.longFrames,
      textures: this.renderer.info.memory.textures,
      largest: largestTextures(),
      pass: growth <= 1.1,
    };
    (window as unknown as { perf: { last: SoakResult } }).perf.last = result;
    console.info(`[perf] soak ${JSON.stringify(result)}`);
    this.running = false;
    return result;
  }
}
