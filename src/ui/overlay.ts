import { actions, publicUrl, store } from '../app.js';
import { AMBIENTS } from '../audio/beds.js';
import { getLang, onLangChange, t } from '../i18n/index.js';
import { type AppState, INTERVALS, LENGTHS, PATTERN_IDS, PLACES, PRACTICES, type Prefs } from '../state.js';
import { stats } from '../storage.js';
import { SessionSystemRef } from './session-ref.js';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** A radio-style group of buttons bound to one pref. */
function radioGroup<K extends keyof Prefs>(
  container: HTMLElement,
  key: K,
  values: readonly Prefs[K][],
  label: (v: Prefs[K]) => string,
  className = 'chip',
  decorate?: (btn: HTMLButtonElement, v: Prefs[K]) => void,
  extra?: (v: Prefs[K]) => Partial<Prefs>,
) {
  const buttons = values.map((v) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => store.setPrefs({ [key]: v, ...extra?.(v) } as Partial<Prefs>));
    decorate?.(b, v);
    container.append(b);
    return { b, v };
  });
  // Arrow-key navigation inside the group.
  container.addEventListener('keydown', (e) => {
    const i = buttons.findIndex((x) => x.b === document.activeElement);
    if (i < 0) return;
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = buttons[(i + d + buttons.length) % buttons.length];
    n.b.focus();
    n.b.click();
  });
  return {
    render(current: Prefs[K]) {
      for (const { b, v } of buttons) {
        const on = v === current;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
        const text = label(v);
        const span = b.querySelector('span');
        if (span) span.textContent = text;
        else b.textContent = text;
      }
    },
  };
}

export function mountOverlay() {
  const overlay = $('overlay');

  const practices = radioGroup($('practices'), 'practice', PRACTICES, (p) => t(`practice.${p}`));
  const lengths = radioGroup($('lengths'), 'minutes', LENGTHS, (m) => `${m} ${t('ui.min')}`);
  const patterns = radioGroup($('patterns'), 'pattern', PATTERN_IDS, (p) => t(`pattern.${p}`));
  const intervals = radioGroup($('intervals'), 'interval', INTERVALS, (s) =>
    s === 0 ? t('ui.interval.off') : `${s / 60} ${t('ui.min')}`,
  );
  const ambients = radioGroup($('ambients'), 'ambient', AMBIENTS, (a) => t(`ambient.${a}`));

  const volA = $<HTMLInputElement>('vol-ambient');
  const volB = $<HTMLInputElement>('vol-bells');
  volA.addEventListener('input', () => store.setPrefs({ ambientVolume: Number(volA.value) }));
  volB.addEventListener('input', () => store.setPrefs({ bellVolume: Number(volB.value) }));

  $('lang').addEventListener('click', () => store.setPrefs({ lang: getLang() === 'en' ? 'zh' : 'en' }));
  $('begin-vr').addEventListener('click', () => actions.begin({ vr: true }));
  $('change-place').addEventListener('click', () => actions.openHub());
  $('begin-2d').addEventListener('click', () => actions.begin({ vr: false }));
  $('pause').addEventListener('click', () => actions.pause());
  $('resume').addEventListener('click', () => actions.resume());
  $('end').addEventListener('click', () => actions.end());
  $('again').addEventListener('click', () => actions.begin({ vr: false }));
  $('to-menu').addEventListener('click', () => actions.backToMenu());
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const m = store.get().mode;
      if (m === 'running') actions.pause();
      else if (m === 'paused') actions.resume();
    }
  });

  let captionTimer = 0;

  const translateStatic = () => {
    document.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => {
      el.textContent = t(el.dataset.t!);
    });
    document.title = t('app.title');
  };

  const render = (s: AppState, prev: AppState | null) => {
    const p = s.prefs;
    overlay.dataset.mode = s.mode;
    overlay.dataset.loading = String(s.loading);
    overlay.dataset.immersive = String(s.immersive);

    if (!prev || p !== prev.prefs || prev.prefs.lang !== p.lang) {
      practices.render(p.practice);
      lengths.render(p.minutes);
      patterns.render(p.pattern);
      intervals.render(p.interval);
      ambients.render(p.ambient);
      $('practice-desc').textContent = t(`practice.${p.practice}.desc`);
      $('pattern-wrap').hidden = p.practice !== 'breath';
      $('interval-wrap').hidden = p.practice !== 'open';
      volA.value = String(p.ambientVolume);
      volB.value = String(p.bellVolume);
    }

    $('begin-vr').hidden = !s.xrSupported;
    $('no-xr').hidden = s.xrSupported;
    $('begin-2d').className = s.xrSupported ? 'secondary' : 'primary';

    if (!prev || s.remaining !== prev.remaining) {
      $('time').textContent = fmt(s.remaining);
      $('paused-time').textContent = fmt(s.remaining);
    }

    const caption = $('caption');
    if (!prev || s.cue !== prev.cue) {
      clearTimeout(captionTimer);
      if (s.cue) {
        caption.textContent = s.cue;
        caption.classList.add('on');
      } else {
        caption.classList.remove('on');
        // Let the fade finish before clearing the text.
        captionTimer = window.setTimeout(() => (caption.textContent = ''), 1300);
      }
    }

    if (s.mode === 'menu' && (!prev || prev.mode !== 'menu')) {
      const st = stats();
      $('stats').textContent = st.sessions ? t('ui.stats', st) : '';
    }
    if (s.mode === 'summary' && prev?.mode !== 'summary') {
      const sat = SessionSystemRef.lastSat() ?? p.minutes;
      $('summary-line').textContent = t('ui.summary', { minutes: sat, practice: `practice.${p.practice}` });
      $('summary-stats').textContent = t('ui.stats', stats());
    }
  };

  translateStatic();
  render(store.get(), null);
  store.subscribe(render);
  onLangChange(() => {
    translateStatic();
    render(store.get(), null);
  });
}
