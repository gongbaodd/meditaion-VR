import { describe, expect, it } from 'vitest';
import { detentOffset, nearestDetent, ringXZ, windowAngleDeg, windowFade, windowGlow, wrapPi } from './ring.js';

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
  it('fades the far windows and glows only the front one', () => {
    expect(windowFade(0)).toBe(1);
    expect(windowFade(72)).toBe(1);
    expect(windowFade(108)).toBe(0);
    expect(windowGlow(0)).toBe(1);
    expect(windowGlow(36)).toBe(0);
    expect(windowGlow(18)).toBeCloseTo(0.5, 5);
  });
  it('maps angles to ring positions, front is -Z', () => {
    const [x, z] = ringXZ(0, 3);
    expect(x).toBeCloseTo(0);
    expect(z).toBeCloseTo(-3);
    expect(ringXZ(90, 3)[0]).toBeCloseTo(3);
  });
  it('wraps angles', () => {
    expect(wrapPi(Math.PI * 2 + 0.1)).toBeCloseTo(0.1);
    expect(wrapPi(-Math.PI * 2 - 0.1)).toBeCloseTo(-0.1);
  });
});
