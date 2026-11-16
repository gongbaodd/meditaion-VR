/** Pure maths for the hub's window carousel. No engine imports so it is unit-testable. */

export const COUNT = 6;
/** Degrees between neighbouring windows on the ring. */
export const STEP_DEG = 36;
/** Dial (knob) degrees per detent: one full turn = all six places. */
export const KNOB_DEG_PER_DETENT = 360 / COUNT;
const HALF_RANGE = (COUNT * STEP_DEG) / 2;
/** Windows are fully visible inside this angle and fade out to FADE_END. */
const FADE_START = 75;
const FADE_END = 105;

export const mod = (a: number, n = COUNT) => ((a % n) + n) % n;

/** Detent index nearest to a continuous dial value. */
export function nearestDetent(value: number): number {
  return mod(Math.round(value));
}

/** Shortest signed distance from `value` to detent `index` (in detents). */
export function detentOffset(index: number, value: number): number {
  let d = mod(index - value);
  if (d > COUNT / 2) d -= COUNT;
  return d;
}

/** Angle in degrees of window `index` from straight ahead (positive = to the right). */
export function windowAngleDeg(index: number, value: number): number {
  const a = detentOffset(index, value) * STEP_DEG;
  return Math.max(-HALF_RANGE, Math.min(HALF_RANGE, a));
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** 0..1 visibility of a window at `angleDeg`. */
export function windowFade(angleDeg: number): number {
  const a = Math.abs(angleDeg);
  if (a <= FADE_START) return 1;
  if (a >= FADE_END) return 0;
  return 1 - smooth((a - FADE_START) / (FADE_END - FADE_START));
}

/** 0..1 glow: 1 when the window is dead ahead, 0 at one full step away. */
export function windowGlow(angleDeg: number): number {
  return smooth(Math.max(0, 1 - Math.abs(angleDeg) / STEP_DEG));
}

/** Position on the ring (x, z) for an angle, radius r, front = −Z. */
export function ringXZ(angleDeg: number, r: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [Math.sin(a) * r, -Math.cos(a) * r];
}

/** Wrap an angle in radians into (−π, π]. */
export function wrapPi(a: number): number {
  return a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
}
