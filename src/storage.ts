import { AMBIENTS } from './audio/beds.js';
import { INTERVALS, LENGTHS, PATTERN_IDS, PLACES, PRACTICES, type Prefs } from './state.js';
import type { Minutes, PracticeId } from './session/types.js';

const PREFS_KEY = 'still-places.prefs.v1';
const HISTORY_KEY = 'still-places.history.v1';

export function defaultPrefs(): Prefs {
  return {
    place: PLACES[0].id,
    practice: 'breath',
    minutes: 5,
    ambient: PLACES[0].ambient,
    pattern: 'calm',
    interval: 300,
    ambientVolume: 0.5,
    bellVolume: 0.8,
    hd: true,
  };
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / storage disabled: prefs just won't persist */
  }
}

/** Load prefs, dropping any stored value that is no longer valid. */
export function loadPrefs(): Prefs {
  const d = defaultPrefs();
  const s = read<Partial<Prefs>>(PREFS_KEY) ?? {};
  const pick = <K extends keyof Prefs>(k: K, ok: (v: unknown) => boolean): Prefs[K] =>
    ok(s[k]) ? (s[k] as Prefs[K]) : d[k];
  const vol = (v: unknown) => typeof v === 'number' && v >= 0 && v <= 1;
  return {
    place: pick('place', (v) => PLACES.some((p) => p.id === v)),
    practice: pick('practice', (v) => PRACTICES.includes(v as PracticeId)),
    minutes: pick('minutes', (v) => LENGTHS.includes(v as Minutes)),
    ambient: pick('ambient', (v) => AMBIENTS.includes(v as never)),
    pattern: pick('pattern', (v) => PATTERN_IDS.includes(v as never)),
    interval: pick('interval', (v) => INTERVALS.includes(v as number)),
    ambientVolume: pick('ambientVolume', vol),
    bellVolume: pick('bellVolume', vol),
    hd: pick('hd', (v) => typeof v === 'boolean'),
  };
}

export function savePrefs(p: Prefs) {
  write(PREFS_KEY, p);
}

export interface HistoryEntry {
  /** ISO date of completion. */
  date: string;
  practice: PracticeId;
  /** Minutes actually sat (rounded). */
  minutes: number;
  place: string;
}

export function loadHistory(): HistoryEntry[] {
  const h = read<HistoryEntry[]>(HISTORY_KEY);
  return Array.isArray(h) ? h : [];
}

export function addHistory(e: HistoryEntry) {
  const h = loadHistory();
  h.push(e);
  write(HISTORY_KEY, h.slice(-1000));
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export function stats(history = loadHistory(), now = new Date()) {
  const total = history.reduce((a, e) => a + e.minutes, 0);
  const days = new Set(history.map((e) => dayKey(new Date(e.date))));
  // Streak: consecutive days with a session, counting back from today (or yesterday).
  let streak = 0;
  const d = new Date(now);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return { sessions: history.length, total, streak };
}
