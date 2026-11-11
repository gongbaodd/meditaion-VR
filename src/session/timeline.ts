import type { BreathPattern, Cue, Minutes, PhaseId, PracticeId, Session } from './types.js';

/**
 * Phase lengths in seconds per session length (see src/plan/README.md §4).
 * Main = total − the rest.
 */
const PHASES: Record<Minutes, Record<Exclude<PhaseId, 'main'>, number>> = {
  3: { arrive: 15, settle: 15, anchor: 20, close: 20 },
  5: { arrive: 25, settle: 30, anchor: 45, close: 30 },
  10: { arrive: 40, settle: 60, anchor: 60, close: 60 },
  20: { arrive: 60, settle: 90, anchor: 120, close: 90 },
};

export const PATTERNS = {
  natural: null,
  calm: [4, 0, 6, 0],
  box: [4, 4, 4, 4],
  relax: [4, 7, 8, 0],
} as const satisfies Record<string, BreathPattern | null>;
export type PatternId = keyof typeof PATTERNS;

export const BODY_REGIONS = [
  'feet',
  'legs',
  'hips',
  'belly',
  'chest',
  'hands',
  'shoulders',
  'neck',
  'face',
  'head',
] as const;

export const METTA_TARGETS = ['self', 'friend', 'neutral', 'all'] as const;
export const METTA_PHRASES = 4;

const ANCHOR: Record<PracticeId, string> = {
  breath: 'cue.anchor.breath',
  bodyscan: 'cue.anchor.body',
  open: 'cue.anchor.sound',
  metta: 'cue.anchor.heart',
};

export interface BuildOptions {
  /** Breath pattern used during the main phase of the breathing practice. */
  pattern?: PatternId;
  /** Interval bell period for open sitting, in seconds. 0 = none. */
  intervalBell?: number;
}

export function buildSession(
  practice: PracticeId,
  minutes: Minutes,
  opts: BuildOptions = {},
): Session {
  const duration = minutes * 60;
  const p = PHASES[minutes];
  const mainLen = duration - p.arrive - p.settle - p.anchor - p.close;
  const order: [PhaseId, number][] = [
    ['arrive', p.arrive],
    ['settle', p.settle],
    ['anchor', p.anchor],
    ['main', mainLen],
    ['close', p.close],
  ];
  const phases: Session['phases'] = [];
  let t = 0;
  for (const [id, len] of order) {
    phases.push({ id, start: t, end: t + len });
    t += len;
  }
  const at = (id: PhaseId) => phases.find((x) => x.id === id)!;
  const cues: Cue[] = [];
  const push = (c: Cue) => cues.push(c);
  for (const ph of phases) push({ at: ph.start, kind: 'phase', phase: ph.id });

  // Arrive: light comes up, three bells, posture cue.
  push({ at: 0, kind: 'light', level: 1, fade: Math.min(8, p.arrive * 0.6) });
  push({ at: 1.5, kind: 'bell', bell: 'bowl', count: 3 });
  push({ at: Math.min(10, p.arrive * 0.4), kind: 'text', key: 'cue.arrive', hold: 6 });

  // Settle: the orb leads slow breaths.
  const settle = at('settle');
  push({ at: settle.start, kind: 'orb', visible: true });
  push({ at: settle.start, kind: 'breath', pattern: PATTERNS.calm });
  push({ at: settle.start + 0.5, kind: 'text', key: 'cue.settle', hold: 7 });

  // Anchor: name the anchor; orb continues for breath practice only.
  const anchor = at('anchor');
  push({ at: anchor.start + 1, kind: 'text', key: ANCHOR[practice], hold: 8 });
  if (practice !== 'breath') {
    push({ at: anchor.start + 4, kind: 'breath', pattern: null });
  }

  const main = at('main');
  switch (practice) {
    case 'breath':
      mainBreath(main, opts.pattern ?? 'calm', push);
      break;
    case 'bodyscan':
      mainBodyScan(main, push);
      break;
    case 'open':
      mainOpen(main, opts.intervalBell ?? 300, push);
      break;
    case 'metta':
      mainMetta(main, push);
      break;
  }

  // Close: one bell, widen attention, three bells, end.
  const close = at('close');
  push({ at: close.start, kind: 'bell', bell: 'bowl', count: 1 });
  push({ at: close.start, kind: 'breath', pattern: null });
  push({ at: close.start + 2, kind: 'text', key: 'cue.close.widen', hold: 7 });
  push({ at: close.start + (close.end - close.start) * 0.45, kind: 'text', key: 'cue.close.return', hold: 6 });
  push({ at: close.end - 10, kind: 'orb', visible: false });
  push({ at: close.end - 9, kind: 'bell', bell: 'bowl', count: 3 });
  push({ at: duration, kind: 'end' });

  cues.sort((a, b) => a.at - b.at || order_(a) - order_(b));
  return { practice, minutes, duration, phases, cues };
}

// Phase markers first, then everything else in insertion order (stable sort).
const order_ = (c: Cue) => (c.kind === 'phase' ? 0 : c.kind === 'end' ? 2 : 1);

type Span = { start: number; end: number };
type Push = (c: Cue) => void;

function mainBreath(main: Span, pattern: PatternId, push: Push) {
  push({ at: main.start, kind: 'breath', pattern: PATTERNS[pattern] });
  push({ at: main.start + 1, kind: 'text', key: `cue.breath.pattern.${pattern}`, hold: 7 });
  const len = main.end - main.start;
  // Sparse reminders: roughly every 90 s, never in the last 30 s.
  const reminders = ['cue.breath.wander', 'cue.breath.soften', 'cue.breath.return'];
  let i = 0;
  for (let t = main.start + 75; t < main.end - 30; t += 90) {
    push({ at: t, kind: 'text', key: reminders[i++ % reminders.length], hold: 6 });
  }
  // For longer sessions, release the pacing halfway and let the breath be natural.
  if (len >= 300) {
    const mid = main.start + len * 0.6;
    push({ at: mid, kind: 'breath', pattern: null });
    push({ at: mid + 1, kind: 'text', key: 'cue.breath.release', hold: 7 });
  }
}

function mainBodyScan(main: Span, push: Push) {
  push({ at: main.start, kind: 'orb', visible: false });
  const len = main.end - main.start;
  const step = len / BODY_REGIONS.length;
  BODY_REGIONS.forEach((region, i) => {
    push({ at: main.start + i * step + 1, kind: 'text', key: `cue.body.${region}`, hold: Math.min(8, step * 0.6) });
  });
}

function mainOpen(main: Span, interval: number, push: Push) {
  push({ at: main.start, kind: 'orb', visible: false });
  push({ at: main.start + 1, kind: 'text', key: 'cue.open.start', hold: 7 });
  if (interval > 0) {
    for (let t = main.start + interval; t < main.end - 20; t += interval) {
      push({ at: t, kind: 'bell', bell: 'chime', count: 1 });
    }
  }
}

function mainMetta(main: Span, push: Push) {
  push({ at: main.start, kind: 'orb', visible: true });
  const len = main.end - main.start;
  const per = len / METTA_TARGETS.length;
  METTA_TARGETS.forEach((target, i) => {
    const s = main.start + i * per;
    if (i > 0) push({ at: s, kind: 'bell', bell: 'chime', count: 1 });
    push({ at: s + 1.5, kind: 'text', key: `cue.metta.${target}`, hold: 7 });
    const phraseGap = (per - 10) / METTA_PHRASES;
    for (let k = 0; k < METTA_PHRASES; k++) {
      push({
        at: s + 10 + k * phraseGap,
        kind: 'text',
        key: `cue.metta.phrase.${k + 1}`,
        hold: Math.min(7, phraseGap * 0.8),
        vars: { who: `metta.who.${target}` },
      });
    }
  });
}
