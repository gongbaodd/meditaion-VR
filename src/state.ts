import type { AmbientId } from './audio/beds.js';
import placesJson from './data/places.json';
import type { PatternId } from './session/timeline.js';
import type { Minutes, PracticeId } from './session/types.js';

export interface Place {
  id: string;
  polyhaven: string;
  name: string;
  /** Accent colour (hex) for the hub window glow. */
  color: string;
  ambient: AmbientId;
  /** Horizontal position (0–1) of the view the user should face, in the equirect image. */
  focusU: number;
  domeIntensity: number;
  iblIntensity: number;
}
export const PLACES = placesJson as Place[];
export const PRACTICES: PracticeId[] = ['breath'];
export const LENGTHS: Minutes[] = [3, 5, 10, 20];
export const PATTERN_IDS: PatternId[] = ['relax'];

export interface Prefs {
  place: string;
  practice: PracticeId;
  minutes: Minutes;
  ambient: AmbientId;
  pattern: PatternId;
  ambientVolume: number;
  bellVolume: number;
  hd: boolean;
}

/**
 * hub      VR only: ring of place windows + dial
 * menu     choosing (2D overlay or VR panel)
 * running  session clock is advancing
 * paused   clock frozen, pause panel shown
 * summary  session finished, summary shown
 */
export type Mode = 'hub' | 'menu' | 'running' | 'paused' | 'summary';

export interface AppState {
  prefs: Prefs;
  mode: Mode;
  /** Place currently on the dome (may lag prefs.place while loading). */
  shownPlace: string | null;
  loading: boolean;
  immersive: boolean;
  xrSupported: boolean;
  /** Current on-screen cue text (resolved text), or '' */
  cue: string;
  /** Seconds remaining in the running session. */
  remaining: number;
}

type Listener = (s: AppState, prev: AppState) => void;

export class Store {
  private listeners = new Set<Listener>();
  constructor(public state: AppState) {}

  get(): AppState {
    return this.state;
  }

  set(patch: Partial<AppState>) {
    const prev = this.state;
    this.state = { ...prev, ...patch };
    this.listeners.forEach((l) => l(this.state, prev));
  }

  setPrefs(patch: Partial<Prefs>) {
    this.set({ prefs: { ...this.state.prefs, ...patch } });
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}
