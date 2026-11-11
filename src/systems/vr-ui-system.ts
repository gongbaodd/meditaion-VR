import { createSystem, type UIKit, type UIKitMLAsset } from '@iwsdk/core';
import { actions, store } from '../app.js';
import { AMBIENTS } from '../audio/beds.js';
import { getLang, onLangChange, t } from '../i18n/index.js';
import { type AppState, LENGTHS, PLACES, PRACTICES } from '../state.js';
import { stats } from '../storage.js';
import { vrFontFamilies } from '../ui/vr-font.js';
import { placeInFront } from './placement.js';
import { SessionSystem } from './session-system.js';

type PanelId = 'vr-menu' | 'vr-cue' | 'vr-hud' | 'vr-pause' | 'vr-summary';
const PANELS: PanelId[] = ['vr-menu', 'vr-cue', 'vr-hud', 'vr-pause', 'vr-summary'];

const SELECTED = { backgroundColor: '#f1d9a8', color: '#1a1712', borderColor: '#f1d9a8' };
const UNSELECTED = { backgroundColor: '#24272c', color: '#eceef1', borderColor: '#4a4e56' };

/** Where each panel sits relative to the viewer: distance, height offset, pitch. */
const LAYOUT: Record<PanelId, [number, number, number]> = {
  'vr-menu': [1.2, -0.2, -10],
  'vr-cue': [1.5, -0.5, -14],
  'vr-hud': [1.1, -0.62, -40],
  'vr-pause': [1.1, -0.15, -8],
  'vr-summary': [1.2, -0.15, -8],
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Spatial UI for immersive mode. Panels are declared in the scene JSON; this
 * system wires clicks, fills translated labels, and shows the right panel for
 * the current mode, placed in front of wherever the viewer is looking.
 */
export class VRUISystem extends createSystem({}) {
  private panels = new Map<PanelId, UIKitMLAsset>();
  private shown = new Set<PanelId>();

  init(): void {
    for (const id of PANELS) {
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
    for (const p of PLACES) this.on('vr-menu', `place-${p.id}`, () => store.setPrefs({ place: p.id, ambient: p.ambient }));
    for (const p of PRACTICES) this.on('vr-menu', `practice-${p}`, () => store.setPrefs({ practice: p }));
    for (const m of LENGTHS) this.on('vr-menu', `len-${m}`, () => store.setPrefs({ minutes: m }));
    for (const a of AMBIENTS) this.on('vr-menu', `amb-${a}`, () => store.setPrefs({ ambient: a }));
    this.on('vr-menu', 'begin', () => actions.begin({ vr: true }));
    this.on('vr-menu', 'lang', () => store.setPrefs({ lang: getLang() === 'en' ? 'zh' : 'en' }));
    this.on('vr-menu', 'exit', () => actions.exitVR());
    this.on('vr-hud', 'hud', () => actions.pause());
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
    set('vr-menu', 'lbl-place', t('ui.place').toUpperCase());
    set('vr-menu', 'lbl-practice', t('ui.practice').toUpperCase());
    set('vr-menu', 'lbl-length', t('ui.length').toUpperCase());
    set('vr-menu', 'lbl-sound', t('ui.sound').toUpperCase());
    for (const p of PLACES) set('vr-menu', `place-${p.id}`, p.name[lang]);
    for (const p of PRACTICES) set('vr-menu', `practice-${p}`, t(`practice.${p}`));
    for (const m of LENGTHS) set('vr-menu', `len-${m}`, `${m} ${t('ui.min')}`);
    for (const a of AMBIENTS) set('vr-menu', `amb-${a}`, t(`ambient.${a}`));
    set('vr-menu', 'begin', t('ui.begin'));
    set('vr-menu', 'lang', t('ui.language'));
    set('vr-menu', 'exit', t('ui.exitVR'));
    set('vr-hud', 'hud-pause', t('ui.pause'));
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
      for (const x of PLACES) mark(`place-${x.id}`, x.id === p.place);
      for (const x of PRACTICES) mark(`practice-${x}`, x === p.practice);
      for (const x of LENGTHS) mark(`len-${x}`, x === p.minutes);
      for (const x of AMBIENTS) mark(`amb-${x}`, x === p.ambient);
    }

    if (!s.immersive) {
      PANELS.forEach((id) => this.hide(id));
      return;
    }

    const want = new Set<PanelId>();
    if (s.mode === 'menu') want.add('vr-menu');
    if (s.mode === 'running') {
      want.add('vr-hud');
      if (s.cue) want.add('vr-cue');
    }
    if (s.mode === 'paused') want.add('vr-pause');
    if (s.mode === 'summary') want.add('vr-summary');

    const modeChanged = !prev || prev.mode !== s.mode || prev.immersive !== s.immersive;
    if (prev && !prev.immersive) this.reanchorIn = 20;
    for (const id of PANELS) {
      if (!want.has(id)) this.hide(id);
      // Re-anchor on mode changes so the panel appears wherever the viewer now faces.
      else if (!this.shown.has(id) || (modeChanged && id !== 'vr-cue' && id !== 'vr-hud')) this.show(id);
    }

    if (s.cue && (!prev || s.cue !== prev.cue)) this.el('vr-cue', 'cue-text')?.setProperties({ text: s.cue });
    if (!prev || s.remaining !== prev.remaining) {
      this.el('vr-hud', 'hud-time')?.setProperties({ text: fmt(s.remaining) });
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
      for (const id of [...this.shown]) this.show(id);
    }
  }

  private show(id: PanelId) {
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
