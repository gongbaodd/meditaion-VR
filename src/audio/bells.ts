import type { BellId } from '../session/types.js';

interface BellSpec {
  f0: number;
  /** Partial frequency ratios relative to f0 (singing bowls are inharmonic). */
  ratios: number[];
  amps: number[];
  /** Seconds for each partial to fall by 60 dB. */
  t60: number[];
  /** Detune between the two "twin" modes of each partial, in Hz: produces the bowl's slow beating. */
  beat: number[];
  strike: number;
  gain: number;
  /** Gap between repeated strikes. */
  spacing: number;
}

const SPECS: Record<BellId, BellSpec> = {
  // Medium Himalayan-style bowl.
  bowl: {
    f0: 262,
    ratios: [1, 2.77, 5.18, 8.17, 11.7],
    amps: [1, 0.55, 0.3, 0.12, 0.05],
    t60: [16, 10, 6, 3.5, 2],
    beat: [0.9, 1.6, 2.4, 3.1, 4],
    strike: 0.25,
    gain: 0.32,
    spacing: 4.5,
  },
  'bowl-low': {
    f0: 146,
    ratios: [1, 2.81, 5.3, 8.4],
    amps: [1, 0.5, 0.25, 0.1],
    t60: [20, 12, 7, 4],
    beat: [0.6, 1.2, 1.9, 2.6],
    strike: 0.2,
    gain: 0.38,
    spacing: 5.5,
  },
  // Small bright bell for interval/transition marks.
  chime: {
    f0: 1318,
    ratios: [1, 2.32, 4.25, 6.63],
    amps: [1, 0.4, 0.2, 0.08],
    t60: [7, 3.5, 1.8, 1],
    beat: [1.5, 2.5, 3.5, 4.5],
    strike: 0.12,
    gain: 0.14,
    spacing: 3,
  },
};

export function bellSpacing(id: BellId): number {
  return SPECS[id].spacing;
}

/** Schedule one synthesized strike at `when` into `out`. */
export function strikeBell(
  ctx: BaseAudioContext,
  out: AudioNode,
  id: BellId,
  when: number,
  velocity = 1,
): void {
  const s = SPECS[id];
  // Each real bowl is slightly different every strike.
  const pitch = 1 + (Math.random() - 0.5) * 0.004;
  const vel = velocity * (0.9 + Math.random() * 0.15);
  const strikeGain = ctx.createGain();
  strikeGain.gain.value = s.gain * vel;
  strikeGain.connect(out);

  s.ratios.forEach((r, i) => {
    const f = s.f0 * r * pitch;
    if (f > ctx.sampleRate / 2.2) return;
    const tau = s.t60[i] / 6.91; // exp decay time-constant for −60 dB at t60
    for (const side of [-1, 1]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f + (side * s.beat[i]) / 2;
      const g = ctx.createGain();
      const a = (s.amps[i] / 2) * (side === 1 ? 1 : 0.85);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(a, when + 0.004 + i * 0.002);
      g.gain.setTargetAtTime(0, when + 0.01, tau);
      osc.connect(g).connect(strikeGain);
      osc.start(when);
      osc.stop(when + s.t60[i] + 0.5);
    }
  });

  // Mallet contact: a short, band-limited click.
  const len = Math.floor(ctx.sampleRate * 0.03);
  const nb = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const n = ctx.createBufferSource();
  n.buffer = nb;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = s.f0 * 4;
  bp.Q.value = 1.2;
  const ng = ctx.createGain();
  ng.gain.value = s.strike;
  n.connect(bp).connect(ng).connect(strikeGain);
  n.start(when);

  const longest = Math.max(...s.t60) + 1;
  setTimeout(() => strikeGain.disconnect(), (when - ctx.currentTime + longest) * 1000);
}
