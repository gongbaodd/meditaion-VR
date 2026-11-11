export type PracticeId = 'breath' | 'bodyscan' | 'open' | 'metta';
export type Minutes = 3 | 5 | 10 | 20;
export type PhaseId = 'arrive' | 'settle' | 'anchor' | 'main' | 'close';
export type BellId = 'bowl' | 'bowl-low' | 'chime';

/** Breath pattern in seconds: inhale, hold-in, exhale, hold-out. */
export type BreathPattern = readonly [number, number, number, number];

export type Cue =
  | { at: number; kind: 'phase'; phase: PhaseId }
  | { at: number; kind: 'bell'; bell: BellId; count: number }
  | { at: number; kind: 'text'; key: string; hold: number; vars?: Record<string, string> }
  | { at: number; kind: 'breath'; pattern: BreathPattern | null }
  | { at: number; kind: 'orb'; visible: boolean }
  | { at: number; kind: 'light'; level: number; fade: number }
  | { at: number; kind: 'end' };

export interface Session {
  practice: PracticeId;
  minutes: Minutes;
  duration: number;
  phases: { id: PhaseId; start: number; end: number }[];
  /** Sorted by `at`. */
  cues: Cue[];
}
