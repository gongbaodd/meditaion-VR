import { describe, expect, it } from 'vitest';
import { deckSlot, detentOffset, nearestDetent, stepSpring, stepTarget, wrapPi, type DeckSlot, type Spring } from './ring.js';

const slot = (o: number) => deckSlot(o, { x: 0, depth: 0, fade: 0, glow: 0 } as DeckSlot);

describe('hub deck', () => {
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
  it('puts the front window dead ahead, glowing', () => {
    const s = slot(0);
    expect(s.x).toBe(0);
    expect(s.depth).toBe(3);
    expect(s.fade).toBe(1);
    expect(s.glow).toBe(1);
  });
  it('mirrors left and right, a bit further back and dim', () => {
    const r = slot(1);
    const l = slot(-1);
    expect(r.x).toBeCloseTo(-l.x);
    expect(r.x).toBeGreaterThan(0);
    expect(r.depth).toBeGreaterThan(3);
    expect(r.glow).toBe(0);
    expect(r.fade).toBe(1);
  });
  it('hides windows two or more slots away', () => {
    expect(slot(2).fade).toBe(0);
    expect(slot(-3).fade).toBe(0);
    expect(slot(3).fade).toBe(0);
  });
  it('moves continuously between slots', () => {
    const a = slot(0.5);
    expect(a.x).toBeGreaterThan(0);
    expect(a.x).toBeLessThan(0.8);
    expect(a.glow).toBeCloseTo(0.5, 5);
  });
  it('keeps the target until the knob is well past halfway', () => {
    expect(stepTarget(0.55, 0)).toBe(0);
    expect(stepTarget(0.59, 0)).toBe(0);
    expect(stepTarget(0.7, 0)).toBe(1);
    // coming back: stays on 1 until value is below 0.4
    expect(stepTarget(0.45, 1)).toBe(1);
    expect(stepTarget(0.3, 1)).toBe(0);
  });
  it('eases into the target without overshoot', () => {
    const s: Spring = { x: 0, v: 0 };
    let prev = 0;
    const steps: number[] = [];
    for (let i = 0; i < 120; i++) {
      stepSpring(s, 1, 0.16, 1 / 72);
      steps.push(s.x - prev);
      expect(s.x).toBeLessThanOrEqual(1);
      expect(s.x).toBeGreaterThanOrEqual(prev);
      prev = s.x;
    }
    expect(s.x).toBeCloseTo(1, 3);
    // slow start: each of the first frames covers more than the one before
    expect(steps[0]).toBeLessThan(0.02);
    expect(steps[1]).toBeGreaterThan(steps[0]);
    expect(steps[2]).toBeGreaterThan(steps[1]);
    // fully settled after 120 frames
    expect(1 - s.x).toBeLessThan(0.001);
  });
  it('wraps angles', () => {
    expect(wrapPi(Math.PI * 2 + 0.1)).toBeCloseTo(0.1);
    expect(wrapPi(-Math.PI * 2 - 0.1)).toBeCloseTo(-0.1);
  });
});
