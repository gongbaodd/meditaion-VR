/**
 * Pure maths for the hub's window deck. No engine imports so it is unit-testable.
 *
 * The windows stand in a shallow stack straight ahead: the front one is at slot 0, its
 * neighbours peek out left and right (slot ±1) and sit slightly behind it, the rest are hidden.
 * Turning the dial moves the stack by one slot at a time (see `stepTarget` and `stepSpring`).
 */

export const COUNT = 6;
/** Dial (knob) degrees per detent: one full turn = all six places. */
export const KNOB_DEG_PER_DETENT = 360 / COUNT;

/** Slot positions by distance from the front (0, 1, 2, 3 slots away), metres. */
const SLOT_X = [0, 0.8, 1.2, 0];
const SLOT_DEPTH = [3, 3.5, 4, 4.5];

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

const smooth = (t: number) => t * t * (3 - 2 * t);

export interface DeckSlot {
  /** Metres to the right of straight ahead. */
  x: number;
  /** Metres in front of the player (positive; the scene z is −depth). */
  depth: number;
  /** 0..1 visibility. */
  fade: number;
  /** 0..1 glow: 1 for the front window, 0 once it is a full slot away. */
  glow: number;
}

/** Fill `out` with where a window sits when it is `offset` slots from the front (−3..3). */
export function deckSlot(offset: number, out: DeckSlot): DeckSlot {
  const a = Math.min(3, Math.abs(offset));
  const k = Math.min(2, Math.floor(a));
  const f = a - k;
  const sign = offset < 0 ? -1 : 1;
  out.x = sign * (SLOT_X[k] + (SLOT_X[k + 1] - SLOT_X[k]) * f);
  out.depth = SLOT_DEPTH[k] + (SLOT_DEPTH[k + 1] - SLOT_DEPTH[k]) * f;
  out.fade = a <= 1 ? 1 : a >= 2 ? 0 : 1 - smooth(a - 1);
  out.glow = smooth(Math.max(0, 1 - a));
  return out;
}

/**
 * Which detent the windows should settle on while the knob is at `value`.
 * It keeps `target` until the knob is clearly past the halfway point (0.6 of a detent away),
 * so hand shake near the middle neither moves the windows nor makes them flicker back and forth.
 */
export function stepTarget(value: number, target: number): number {
  return Math.abs(value - target) > 0.6 ? Math.round(value) : target;
}

export interface Spring {
  x: number;
  v: number;
}

/**
 * Critically damped chase of `target` (no overshoot): starts slowly, speeds up, slows into place.
 * `smoothTime` is roughly the time to cover most of the distance. Mutates `s`, allocates nothing.
 */
export function stepSpring(s: Spring, target: number, smoothTime: number, dt: number): void {
  if (dt <= 0) return;
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = s.x - target;
  const temp = (s.v + omega * change) * dt;
  s.v = (s.v - omega * temp) * decay;
  s.x = target + (change + temp) * decay;
  // Never run past the target.
  if (change > 0 === s.x < target) {
    s.x = target;
    s.v = 0;
  }
}

/** Wrap an angle in radians into (−π, π]. */
export function wrapPi(a: number): number {
  return a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
}
