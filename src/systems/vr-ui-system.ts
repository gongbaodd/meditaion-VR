import { createSystem, type UIKit, type UIKitMLAsset } from '@iwsdk/core';
import { actions, store } from '../app.js';
import { AMBIENTS } from '../audio/beds.js';
import { getLang, onLangChange, t } from '../i18n/index.js';
import { cycle } from '../hand/palm.js';
import { type AppState, LENGTHS, PLACES, PRACTICES } from '../state.js';
import { stats } from '../storage.js';
import { vrFontFamilies } from '../ui/vr-font.js';
import { placeInFront } from './placement.js';
import { SessionSystem } from './session-system.js';

type PlacedId = 'vr-menu' | 'vr-cue' | 'vr-pause' | 'vr-summary';
type PanelId = PlacedId | 'vr-hand-menu' | 'vr-hand-hud' | 'vr-hand-hub';
/** Panels this system places in front of the viewer. */
const PANELS: PlacedId[] = ['vr-menu', 'vr-cue', 'vr-pause', 'vr-summary'];
/** Panels that ride on a raised hand; HandMenuSystem places and shows them, this system wires and labels them. */
const HAND_PANELS: PanelId[] = ['vr-hand-menu', 'vr-hand-hud', 'vr-hand-hub'];

const SELECTED = { backgroundColor: '#f1d9a8', color: '#1a1712', borderColor: '#f1d9a8' };
const UNSELECTED = { backgroundColor: '#24272c', color: '#eceef1', borderColor: '#4a4e56' };

/** Where each panel sits relative to the viewer: distance, height offset, pitch. */
const LAYOUT: Record<PlacedId, [number, number, number]> = {
  'vr-menu': [1.2, -0.2, -10],
  'vr-cue': [1.5, -0.5, -14],
  'vr-pause': [1.1, -0.15, -8],
  'vr-summary': [1.2, -0.15, -8],
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Spatial UI for immersive mode. Panels are declared in the scene JSON; this
 * system wires clicks, fills translated labels, and shows the right panel for
 * the current mode, placed in front of wherever the viewer is looking. The menu and
 * the session HUD live on a raised hand instead (HandMenuSystem); the in-front menu
 * only returns as a fallback when no hand or controller is tracked.
 */
export class VRUISystem extends createSystem({}) {
  private panels = new Map<PanelId, UIKitMLAsset>();
  private shown = new Set<PanelId>();

  init(): void {
    for (const id of [...PANELS, ...HAND_PANELS]) {
      const p = this.world.getSceneObject<UIKitMLAsset>(id);
      if (!p) {
        console.warn(`[vr-ui] missing scene panel ${id}`);
        continue;
      }
      this.panels.set(id, p);
      // CJK-capable font with a full charset (see src/ui/vr-font.ts).
      p.document.rootElement.setProperties({ fontFamilies: vrFontFamilies(), fontFamily: 'ui' } as never);
      this.hide(id);
    }
    this.wire();
    this.relabel();
    this.render(store.get(), null);
    this.cleanupFuncs.push(
      store.subscribe((s, prev) => this.render(s, prev)),
      onLangChange(() => {
        this.relabel();
        this.render(store.get(), null);
      }),
    );
  }

  /** True when the hand menu can't be used (nothing tracked), so the menu is shown in front instead. */
  private fallback = false;
  /** The first-use hint "look at your palm" is shown until the hand menu has opened once. */
  private hintDone = false;

  get fallbackActive() {
    return this.fallback;
  }

  setFallback(on: boolean) {
    if (on === this.fallback) return;
    this.fallback = on;
    this.render(store.get(), store.get());
  }

  private hubPlace = 0;

  /** Place under the hub dial; shown on the hand panel's stepper. */
  setHubPlace(i: number) {
    this.hubPlace = i;
    this.showHubPlace();
  }

  private showHubPlace() {
    this.el('vr-hand-hub', 'hb-val')?.setProperties({ text: PLACES[this.hubPlace]?.name[getLang()] ?? '' });
  }

  dismissHint() {
    if (this.hintDone) return;
    this.hintDone = true;
    this.render(store.get(), store.get());
  }

  private el(panel: PanelId, id: string): UIKit.Text | undefined {
    return this.panels.get(panel)?.getElementById<UIKit.Text>(id) ?? undefined;
  }

  /** When each panel was last shown; clicks right after are ignored (see `on`). */
  private shownAt = new Map<PanelId, number>();

  private on(panel: PanelId, id: string, fn: () => void) {
    const e = this.el(panel, id);
    if (!e) return console.warn(`[vr-ui] ${panel}#${id} not found`);
    // The trigger press that pauses also releases a moment later, possibly over the
    // pause panel that just appeared under the ray. Ignore that accidental click.
    const guarded = () => {
      if (performance.now() - (this.shownAt.get(panel) ?? 0) < 400) return;
      fn();
    };
    e.addEventListener('click', guarded);
    this.cleanupFuncs.push(() => e.removeEventListener('click', guarded));
  }

  private wire() {
    this.on('vr-menu', 'change-place', () => actions.openHub());
    for (const p of PRACTICES) this.on('vr-menu', `practice-${p}`, () => store.setPrefs({ practice: p }));
    for (const m of LENGTHS) this.on('vr-menu', `len-${m}`, () => store.setPrefs({ minutes: m }));
    for (const a of AMBIENTS) this.on('vr-menu', `amb-${a}`, () => store.setPrefs({ ambient: a }));
    this.on('vr-menu', 'begin', () => actions.begin({ vr: true }));
    this.on('vr-menu', 'lang', () => store.setPrefs({ lang: getLang() === 'en' ? 'zh' : 'en' }));
    this.on('vr-menu', 'exit', () => actions.exitVR());
    this.on('vr-hand-hud', 'hh', () => actions.pause());
    // Hand menu: ‹ value › steppers, same effects as the chips on the in-front menu.
    const step = (id: string, apply: (d: 1 | -1) => void) => {
      this.on('vr-hand-menu', `hm-${id}-prev`, () => apply(-1));
      this.on('vr-hand-menu', `hm-${id}-next`, () => apply(1));
      this.on('vr-hand-menu', `hm-${id}-val`, () => apply(1));
    };
    step('practice', (d) => store.setPrefs({ practice: cycle(PRACTICES, store.get().prefs.practice, d) }));
    step('len', (d) => store.setPrefs({ minutes: cycle(LENGTHS, store.get().prefs.minutes, d) }));
    step('amb', (d) => store.setPrefs({ ambient: cycle(AMBIENTS, store.get().prefs.ambient, d) }));
    // Hand hub panel: turn the ring one place at a time, enter the front place, exit.
    this.on('vr-hand-hub', 'hb-prev', () => actions.stepHub(-1));
    this.on('vr-hand-hub', 'hb-next', () => actions.stepHub(1));
    this.on('vr-hand-hub', 'hb-val', () => actions.stepHub(1));
    this.on('vr-hand-hub', 'hb-enter', () => actions.enterHub());
    this.on('vr-hand-hub', 'hb-lang', () => store.setPrefs({ lang: getLang() === 'en' ? 'zh' : 'en' }));
    this.on('vr-hand-hub', 'hb-exit', () => actions.exitVR());
    this.on('vr-hand-menu', 'hm-begin', () => actions.begin({ vr: true }));
    this.on('vr-hand-menu', 'hm-place', () => actions.openHub());
    this.on('vr-hand-menu', 'hm-lang', () => store.setPrefs({ lang: getLang() === 'en' ? 'zh' : 'en' }));
    this.on('vr-hand-menu', 'hm-exit', () => actions.exitVR());
    this.on('vr-pause', 'resume', () => actions.resume());
    this.on('vr-pause', 'end', () => actions.end());
    this.on('vr-summary', 'again', () => actions.begin({ vr: true }));
    this.on('vr-summary', 'to-menu', () => actions.backToMenu());
  }

  /** Static, translated labels. */
  private relabel() {
    const lang = getLang();
    const set = (panel: PanelId, id: string, text: string) => this.el(panel, id)?.setProperties({ text });
    set('vr-menu', 'title', t('app.title'));
    set('vr-menu', 'tagline', t('app.tagline'));
    set('vr-menu', 'lbl-practice', t('ui.practice').toUpperCase());
    set('vr-menu', 'lbl-length', t('ui.length').toUpperCase());
    set('vr-menu', 'lbl-sound', t('ui.sound').toUpperCase());
    set('vr-menu', 'change-place', t('ui.changePlace'));
    for (const p of PRACTICES) set('vr-menu', `practice-${p}`, t(`practice.${p}`));
    for (const m of LENGTHS) set('vr-menu', `len-${m}`, `${m} ${t('ui.min')}`);
    for (const a of AMBIENTS) set('vr-menu', `amb-${a}`, t(`ambient.${a}`));
    set('vr-menu', 'begin', t('ui.begin'));
    set('vr-menu', 'lang', t('ui.language'));
    set('vr-menu', 'exit', t('ui.exitVR'));
    set('vr-hand-menu', 'hm-begin', t('ui.begin'));
    set('vr-hand-menu', 'hm-place', t('ui.changePlace'));
    set('vr-hand-menu', 'hm-lang', t('ui.language'));
    set('vr-hand-menu', 'hm-exit', t('ui.exitVR'));
    set('vr-hand-hub', 'hb-enter', t('ui.enter'));
    set('vr-hand-hub', 'hb-lang', t('ui.language'));
    set('vr-hand-hub', 'hb-exit', t('ui.exitVR'));
    this.showHubPlace();
    set('vr-hand-hud', 'hh-pause', t('ui.pause'));
    set('vr-pause', 'pause-title', t('ui.paused'));
    set('vr-pause', 'resume', t('ui.resume'));
    set('vr-pause', 'end', t('ui.end'));
    set('vr-summary', 'sum-title', t('ui.complete'));
    set('vr-summary', 'again', t('ui.again'));
    set('vr-summary', 'to-menu', t('ui.menu'));
    this.world.getSystem(SessionSystem)?.retranslate();
  }

  private render(s: AppState, prev: AppState | null) {
    const p = s.prefs;
    // Selection state on the menu chips.
    if (!prev || p !== prev.prefs) {
      const mark = (id: string, on: boolean) => this.el('vr-menu', id)?.setProperties(on ? SELECTED : UNSELECTED);
      for (const x of PRACTICES) mark(`practice-${x}`, x === p.practice);
      for (const x of LENGTHS) mark(`len-${x}`, x === p.minutes);
      for (const x of AMBIENTS) mark(`amb-${x}`, x === p.ambient);
      const val = (id: string, text: string) => this.el('vr-hand-menu', id)?.setProperties({ text });
      val('hm-practice-val', t(`practice.${p.practice}`));
      val('hm-len-val', `${p.minutes} ${t('ui.min')}`);
      val('hm-amb-val', t(`ambient.${p.ambient}`));
    }

    if (!s.immersive) {
      PANELS.forEach((id) => this.hide(id));
      HAND_PANELS.forEach((id) => this.hide(id));
      return;
    }

    const want = new Set<PanelId>();
    const hint = s.mode === 'menu' && !this.fallback && !this.hintDone;
    if (s.mode === 'menu') {
      if (this.fallback) want.add('vr-menu');
      else if (hint) want.add('vr-cue');
    }
    if (s.mode === 'running' && s.cue) want.add('vr-cue');
    if (s.mode === 'paused') want.add('vr-pause');
    if (s.mode === 'summary') want.add('vr-summary');

    const modeChanged = !prev || prev.mode !== s.mode || prev.immersive !== s.immersive;
    if (prev && !prev.immersive) this.reanchorIn = 20;
    for (const id of PANELS) {
      if (!want.has(id)) this.hide(id);
      // Re-anchor on mode changes so the panel appears wherever the viewer now faces.
      else if (!this.shown.has(id) || (modeChanged && id !== 'vr-cue')) this.show(id);
    }

    if (hint) this.el('vr-cue', 'cue-text')?.setProperties({ text: t('ui.handHint') });
    else if (s.cue && (!prev || s.cue !== prev.cue || prev.mode === 'menu')) {
      this.el('vr-cue', 'cue-text')?.setProperties({ text: s.cue });
    }
    if (!prev || s.remaining !== prev.remaining) {
      this.el('vr-hand-hud', 'hh-time')?.setProperties({ text: fmt(s.remaining) });
      this.el('vr-pause', 'pause-time')?.setProperties({ text: fmt(s.remaining) });
    }
    if (s.mode === 'summary' && prev?.mode !== 'summary') {
      const sat = this.world.getSystem(SessionSystem)?.lastSat ?? p.minutes;
      const st = stats();
      this.el('vr-summary', 'sum-line')?.setProperties({
        text: t('ui.summary', { minutes: sat, practice: `practice.${p.practice}` }),
      });
      this.el('vr-summary', 'sum-stats')?.setProperties({ text: t('ui.stats', st) });
    }
  }

  /** Frames left before re-anchoring visible panels (the XR head pose is invalid for a moment after entering). */
  private reanchorIn = -1;

  update(): void {
    if (this.reanchorIn < 0) return;
    if (this.reanchorIn-- === 0) {
      for (const id of PANELS) if (this.shown.has(id)) this.show(id);
    }
  }

  private show(id: PlacedId) {
    const p = this.panels.get(id);
    if (!p) return;
    const [d, dy, pitch] = LAYOUT[id];
    // The cue and HUD are anchored to where the session started, like the orb.
    placeInFront(this.world, p, d, dy, pitch);
    p.visible = true;
    if (!this.shown.has(id)) this.shownAt.set(id, performance.now());
    this.shown.add(id);
  }

  private hide(id: PanelId) {
    const p = this.panels.get(id);
    if (!p) return;
    p.visible = false;
    // Park it out of reach so hidden panels can't catch rays.
    p.position.set(0, -50, 0);
    this.shown.delete(id);
  }
}
