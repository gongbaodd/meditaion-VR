/**
 * Pure maths for the hub's window ring. No engine imports so it is unit-testable.
 *
 * The windows stand on a circle around the player, one every STEP_DEG. They never slide:
 * when the dial moves on to another place, the pictures fade out, every window takes its new
 * slot while nothing is showing, and the pictures fade back in (see `stepDissolve`).
 */

export const COUNT = 6;
/** Dial (knob) degrees per detent: one full turn = all six places. */
export const KNOB_DEG_PER_DETENT = 360 / COUNT;

/** Degrees between neighbouring windows on the ring. */
export const STEP_DEG = 36;
const HALF_RANGE = (COUNT * STEP_DEG) / 2;
/** Windows are fully visible inside this angle and hidden beyond FADE_END. */
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

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Angle in degrees of window `index` from straight ahead (positive = to the right). */
export function windowAngleDeg(index: number, value: number): number {
  const a = detentOffset(index, value) * STEP_DEG;
  return Math.max(-HALF_RANGE, Math.min(HALF_RANGE, a));
}

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

/** Position on the ring (x, z) for an angle, radius r, front = −Z. Fills and returns `out`. */
export function ringXZ(angleDeg: number, r: number, out: [number, number]): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  out[0] = Math.sin(a) * r;
  out[1] = -Math.cos(a) * r;
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

export interface Dissolve {
  /** Detent the windows are laid out for right now (unwrapped, whole number). */
  shown: number;
  /** 0..1 raw fade level: 1 = pictures fully shown, 0 = dark. */
  k: number;
}

/**
 * Fade out, switch, fade in. While `s.shown` differs from `target` the level drops; at zero
 * the layout jumps to `target` unseen, then the level rises again. Spinning through several
 * places keeps it dark until the dial rests. Mutates `s`, allocates nothing.
 */
export function stepDissolve(s: Dissolve, target: number, fadeTime: number, dt: number): void {
  if (dt <= 0) return;
  const step = dt / fadeTime;
  if (s.shown !== target) {
    s.k -= step;
    if (s.k <= 0) {
      s.k = 0;
      s.shown = target;
    }
  } else if (s.k < 1) {
    s.k = Math.min(1, s.k + step);
  }
}

/** Ease for a raw 0..1 fade level. */
export const ease = smooth;

/** Wrap an angle in radians into (−π, π]. */
export function wrapPi(a: number): number {
  return a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
}
