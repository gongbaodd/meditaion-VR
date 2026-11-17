import { AudioEngine } from './audio/engine.js';
import { Store } from './state.js';
import { loadPrefs, savePrefs } from './storage.js';

/** Base URL for files in public/, works for both dev and subpath deploys. */
export const BASE = import.meta.env.BASE_URL;
export const publicUrl = (p: string) => new URL(`${BASE}${p.replace(/^\/+/, '')}`, location.href).href;

const prefs = loadPrefs();

export const store = new Store({
  prefs,
  mode: 'hub',
  shownPlace: null,
  loading: true,
  immersive: false,
  xrSupported: false,
  cue: '',
  remaining: 0,
});

export const audio = new AudioEngine(BASE);
audio.setAmbientVolume(prefs.ambientVolume);
audio.setBellVolume(prefs.bellVolume);

// Persist prefs and keep side effects (audio levels, ambience) in sync.
store.subscribe((s, prev) => {
  if (s.prefs === prev.prefs) return;
  savePrefs(s.prefs);
  const p = s.prefs;
  const q = prev.prefs;
  if (p.ambientVolume !== q.ambientVolume) audio.setAmbientVolume(p.ambientVolume);
  if (p.bellVolume !== q.bellVolume) audio.setBellVolume(p.bellVolume);
  if (p.ambient !== q.ambient) audio.setAmbient(p.ambient);
});

/** Commands other modules can call; filled in by systems at init. */
export const actions = {
  begin: async (_opts: { vr: boolean }) => {},
  pause: () => {},
  resume: () => {},
  end: () => {},
  backToHub: () => {},
  openHub: () => {},
  /** Hub: turn the ring one place (hand menu stepper). */
  stepHub: (_d: 1 | -1) => {},
  /** Hub: enter the place in front. */
  enterHub: () => {},
  exitVR: () => {},
};
