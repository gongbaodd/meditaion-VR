import { createSystem, VisibilityState } from '@iwsdk/core';
import { actions, audio, store } from '../app.js';
import { t } from '../strings.js';
import { SessionRunner } from '../session/runner.js';
import { buildSession } from '../session/timeline.js';
import type { Cue } from '../session/types.js';
import { addHistory } from '../storage.js';
import { BreathOrbSystem } from './breath-orb-system.js';
import { PlaceSystem } from './place-system.js';

/**
 * Runs a session: advances the clock each frame and turns cues into
 * bells, on-screen text, orb behaviour and light changes.
 */
export class SessionSystem extends createSystem({}) {
  private runner: SessionRunner | null = null;
  private cueTimer = 0;
  private lastRemaining = -1;

  private get place() {
    return this.world.getSystem(PlaceSystem)!;
  }
  private get orb() {
    return this.world.getSystem(BreathOrbSystem)!;
  }

  init(): void {
    actions.begin = (opts) => this.begin(opts);
    actions.pause = () => this.pause();
    actions.resume = () => this.resume();
    actions.end = () => this.runner?.stop();
    actions.backToMenu = () => this.backToMenu();
    actions.exitVR = () => this.world.exitXR();

    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((v) => {
        store.set({ immersive: v !== VisibilityState.NonImmersive });
        // Headset taken off / system menu opened / left VR: hold the session.
        if (v !== VisibilityState.Visible && store.get().mode === 'running') this.pause();
      }),
    );
  }

  private async begin({ vr }: { vr: boolean }) {
    // Audio must be unlocked inside the click that started this.
    await audio.unlock();
    const p = store.get().prefs;
    audio.setAmbient(p.ambient);
    audio.fadeMaster(1, 0.5);
    if (vr && this.world.xrEnabled && store.get().xrSupported && !store.get().immersive) {
      this.world.launchXR();
    }
    const session = buildSession(p.practice, p.minutes, { pattern: p.pattern });
    this.runner = new SessionRunner(session, (c) => this.onCue(c));
    this.place.setLevel(0.15, 0);
    this.orb.reset();
    // Wait a beat so the headset pose is valid before anchoring the orb.
    setTimeout(() => this.orb.anchor(), vr ? 600 : 0);
    store.set({ mode: 'running', cue: '', remaining: session.duration });
    this.runner.start();
  }

  private pause() {
    if (!this.runner || this.runner.state !== 'running') return;
    this.runner.pause();
    this.orb.freeze(true);
    audio.fadeMaster(0.35, 1.5);
    store.set({ mode: 'paused' });
  }

  private resume() {
    if (!this.runner || this.runner.state !== 'paused') return;
    this.runner.resume();
    this.orb.freeze(false);
    audio.fadeMaster(1, 1.5);
    store.set({ mode: 'running' });
  }

  private backToMenu() {
    if (this.runner && this.runner.state !== 'finished') {
      const r = this.runner;
      this.runner = null; // drop without recording
      r.stop();
    }
    this.orb.reset();
    this.place.setLevel(1, 1.5);
    audio.fadeMaster(1, 1);
    store.set({ mode: 'menu', cue: '' });
  }

  private onCue(c: Cue) {
    switch (c.kind) {
      case 'bell':
        audio.bell(c.bell, c.count);
        break;
      case 'text':
        this.cueTimer = c.hold;
        store.set({ cue: t(c.key, c.vars) });
        break;
      case 'breath':
        this.orb.setPattern(c.pattern);
        break;
      case 'orb':
        this.orb.setVisible(c.visible);
        break;
      case 'light':
        this.place.setLevel(c.level, c.fade);
        break;
      case 'end':
        this.finish();
        break;
      case 'phase':
        break;
    }
  }

  private finish() {
    const r = this.runner;
    if (!r) return; // backToMenu dropped it
    // Only sits of a minute or more count towards history.
    const sat = Math.round(r.elapsed / 60);
    if (r.elapsed >= 60) {
      const p = store.get().prefs;
      addHistory({ date: new Date().toISOString(), practice: r.session.practice, minutes: sat, place: p.place });
    }
    // Set before the store update: the summary UI reads it while rendering.
    this.lastSat = Math.max(1, sat);
    this.orb.setVisible(false);
    this.place.setLevel(1, 2);
    store.set({ mode: 'summary', cue: '', remaining: 0 });
  }

  /** Minutes sat in the last finished session (for the summary). */
  lastSat = 0;


  update(delta: number): void {
    const r = this.runner;
    if (!r) return;
    const mode = store.get().mode;

    // Space toggles pause on desktop. In VR, pause is the in-scene button (VRUISystem)
    // and resume/end are on the hand menu, so no global trigger or pinch pauses.
    if (mode === 'running' && this.world.input.keyboard?.getKeyDown('Space')) {
      this.pause();
      return;
    } else if (mode === 'paused' && this.world.input.keyboard?.getKeyDown('Space')) {
      this.resume();
      return;
    }

    if (r.state !== 'running') return;
    r.tick(delta);
    if (this.cueTimer > 0) {
      this.cueTimer -= delta;
      if (this.cueTimer <= 0) {
        store.set({ cue: '' });
      }
    }
    const rem = Math.ceil(r.remaining);
    if (rem !== this.lastRemaining) {
      this.lastRemaining = rem;
      if (store.get().mode === 'running') store.set({ remaining: rem });
    }
  }
}
