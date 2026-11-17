import { describe, expect, it } from 'vitest';
import { type Dissolve, detentOffset, nearestDetent, ringXZ, stepDissolve, stepTarget, windowAngleDeg, windowFade, windowGlow, wrapPi } from './ring.js';

describe('hub ring', () => {
  it('snaps to the nearest detent and wraps', () => {
    expect(nearestDetent(0.4)).toBe(0);
    expect(nearestDetent(0.6)).toBe(1);
    expect(nearestDetent(-0.6)).toBe(5);
    expect(nearestDetent(6.2)).toBe(0);
  });
  it('takes the short way round', () => {
    expect(detentOffset(5, 0)).toBe(-1);
    expect(detentOffset(1, 5)).toBe(2);
  });
  it('puts the selected window at 0 degrees', () => {
    expect(windowAngleDeg(2, 2)).toBe(0);
    expect(windowAngleDeg(3, 2)).toBe(36);
    expect(windowAngleDeg(1, 2)).toBe(-36);
    expect(Math.abs(windowAngleDeg(5, 2))).toBe(108);
  });
  it('hides the window behind and glows only the front one', () => {
    expect(windowFade(0)).toBe(1);
    expect(windowFade(72)).toBe(1);
    expect(windowFade(108)).toBe(0);
    expect(windowGlow(0)).toBe(1);
    expect(windowGlow(36)).toBe(0);
  });
  it('maps angles to ring positions, front is -Z', () => {
    const out: [number, number] = [0, 0];
    ringXZ(0, 3, out);
    expect(out[0]).toBeCloseTo(0);
    expect(out[1]).toBeCloseTo(-3);
    expect(ringXZ(90, 3, out)[0]).toBeCloseTo(3);
  });
  it('keeps the target until the knob is well past halfway', () => {
    expect(stepTarget(0.55, 0)).toBe(0);
    expect(stepTarget(0.59, 0)).toBe(0);
    expect(stepTarget(0.7, 0)).toBe(1);
    // coming back: stays on 1 until value is below 0.4
    expect(stepTarget(0.45, 1)).toBe(1);
    expect(stepTarget(0.3, 1)).toBe(0);
  });
  it('fades out, switches while dark, then fades in', () => {
    const s: Dissolve = { shown: 0, k: 1 };
    const dt = 1 / 72;
    let switchedAt = -1;
    for (let i = 0; i < 40; i++) {
      const before = s.shown;
      stepDissolve(s, 1, 0.16, dt);
      if (before === 0 && s.shown === 1) {
        switchedAt = i;
        // the layout only changes at the moment nothing is showing
        expect(s.k).toBe(0);
      }
      expect(s.k).toBeGreaterThanOrEqual(0);
      expect(s.k).toBeLessThanOrEqual(1);
    }
    expect(switchedAt).toBeGreaterThan(5);
    expect(s.shown).toBe(1);
    expect(s.k).toBe(1);
  });
  it('stays dark while the dial keeps moving and lands on the last place', () => {
    const s: Dissolve = { shown: 0, k: 1 };
    for (let i = 0; i < 20; i++) stepDissolve(s, 1, 0.16, 1 / 72);
    expect(s.shown).toBe(1);
    // the target moves on before the fade-in finishes: it goes dark again, no in-between slot
    for (let i = 0; i < 30; i++) stepDissolve(s, 3, 0.16, 1 / 72);
    expect(s.shown).toBe(3);
    expect(s.k).toBe(1);
  });
  it('wraps angles', () => {
    expect(wrapPi(Math.PI * 2 + 0.1)).toBeCloseTo(0.1);
    expect(wrapPi(-Math.PI * 2 - 0.1)).toBeCloseTo(-0.1);
  });
});
