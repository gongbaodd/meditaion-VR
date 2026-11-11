import { describe, expect, it } from 'vitest';
import en from '../i18n/en.json';
import zh from '../i18n/zh.json';
import { SessionRunner } from './runner.js';
import { buildSession } from './timeline.js';
import type { Cue, Minutes, PracticeId } from './types.js';

const PRACTICES: PracticeId[] = ['breath', 'bodyscan', 'open', 'metta'];
const LENGTHS: Minutes[] = [3, 5, 10, 20];
const all = PRACTICES.flatMap((p) => LENGTHS.map((m) => [p, m] as const));

describe('buildSession', () => {
  it.each(all)('%s %d min: phases tile the duration and cues are in range', (p, m) => {
    const s = buildSession(p, m);
    expect(s.duration).toBe(m * 60);
    expect(s.phases[0].start).toBe(0);
    expect(s.phases.at(-1)!.end).toBe(s.duration);
    for (let i = 1; i < s.phases.length; i++) {
      expect(s.phases[i].start).toBe(s.phases[i - 1].end);
      expect(s.phases[i].end).toBeGreaterThan(s.phases[i].start);
    }
    for (const c of s.cues) {
      expect(c.at).toBeGreaterThanOrEqual(0);
      expect(c.at).toBeLessThanOrEqual(s.duration);
    }
    const sorted = [...s.cues].sort((a, b) => a.at - b.at);
    expect(s.cues.map((c) => c.at)).toEqual(sorted.map((c) => c.at));
    expect(s.cues.at(-1)!.kind).toBe('end');
    expect(s.cues.filter((c) => c.kind === 'end')).toHaveLength(1);
  });

  it.each(all)('%s %d min: text cues do not overlap', (p, m) => {
    const texts = buildSession(p, m).cues.filter((c) => c.kind === 'text') as Extract<Cue, { kind: 'text' }>[];
    for (let i = 1; i < texts.length; i++) {
      expect(texts[i].at, `${texts[i].key} starts before ${texts[i - 1].key} ends`).toBeGreaterThanOrEqual(
        texts[i - 1].at + texts[i - 1].hold - 0.001,
      );
    }
  });

  it.each(all)('%s %d min: every text key exists in en and zh', (p, m) => {
    const keys = new Set<string>();
    for (const c of buildSession(p, m).cues) {
      if (c.kind !== 'text') continue;
      keys.add(c.key);
      for (const v of Object.values(c.vars ?? {})) keys.add(v);
    }
    for (const k of keys) {
      expect(en, `en missing ${k}`).toHaveProperty([k]);
      expect(zh, `zh missing ${k}`).toHaveProperty([k]);
    }
  });

  it('open sitting rings an interval bell every 5 minutes of the main phase', () => {
    // 20 min → main phase is 14 min → bells at +5 and +10 min.
    const s = buildSession('open', 20);
    const main = s.phases.find((p) => p.id === 'main')!;
    const bells = s.cues.filter((c) => c.kind === 'bell' && c.bell === 'chime');
    expect(bells.map((b) => b.at - main.start)).toEqual([300, 600]);
    expect(buildSession('open', 20, { intervalBell: 0 }).cues.some((c) => c.kind === 'bell' && c.bell === 'chime')).toBe(false);
  });
});

describe('SessionRunner', () => {
  it('delivers every cue once, in order, and finishes', () => {
    const s = buildSession('breath', 5);
    const seen: Cue[] = [];
    const r = new SessionRunner(s, (c) => seen.push(c));
    r.start();
    for (let i = 0; i < 5 * 60 * 60 + 10; i++) r.tick(1 / 60);
    expect(r.state).toBe('finished');
    expect(seen).toEqual(s.cues);
  });

  it('pause freezes the clock and stop delivers end', () => {
    const s = buildSession('open', 3);
    const seen: Cue[] = [];
    const r = new SessionRunner(s, (c) => seen.push(c));
    r.start();
    r.tick(0.5);
    r.tick(0.5);
    r.pause();
    r.tick(0.5);
    expect(r.elapsed).toBeCloseTo(1);
    r.resume();
    r.tick(0.5);
    expect(r.elapsed).toBeCloseTo(1.5);
    r.stop();
    expect(r.state).toBe('finished');
    expect(seen.at(-1)!.kind).toBe('end');
  });

  it('clamps large frame gaps', () => {
    const r = new SessionRunner(buildSession('open', 3), () => {});
    r.start();
    r.tick(30);
    expect(r.elapsed).toBe(0.5);
  });
});
