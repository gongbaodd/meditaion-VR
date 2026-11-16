/**
 * Pure maths for the palm-up hand menu: where the palm faces, whether the viewer is
 * looking at it, and a show/hide gate with hysteresis. No IWSDK or Three imports, so it
 * can be unit tested; `{x,y,z}` objects such as Three's Vector3 fit the `V` type.
 */

export type V = { x: number; y: number; z: number };
export type Hand = 'left' | 'right';

const R2D = 180 / Math.PI;

/** Palm faces the head within this many degrees to open, and to stay open. */
export const PALM_SHOW = 40;
export const PALM_HOLD = 55;
/** The head looks at the palm within this many degrees to open, and to stay open. */
export const GAZE_SHOW = 35;
export const GAZE_HOLD = 45;
/** Palm-to-head distance range (metres) to open, and to stay open. */
export const DIST_SHOW: [number, number] = [0.2, 0.7];
export const DIST_HOLD: [number, number] = [0.15, 0.8];
/** Seconds of lost tracking before an open menu closes (it holds its last pose meanwhile). */
export const LOST_GRACE = 0.5;

export function angleDeg(a: V, b: V): number {
  const la = Math.hypot(a.x, a.y, a.z);
  const lb = Math.hypot(b.x, b.y, b.z);
  if (la < 1e-9 || lb < 1e-9) return 180;
  const c = (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb);
  return Math.acos(Math.min(1, Math.max(-1, c))) * R2D;
}

/**
 * Palm normal (out of the palm) and the unit vector across the palm towards the little
 * finger, from wrist, index-metacarpal and pinky-metacarpal positions in any common space.
 * Computed from joints because grip orientation differs between devices.
 */
export function palmFrame(wrist: V, indexMeta: V, pinkyMeta: V, hand: Hand, outNormal: V, outSide: V): void {
  const ax = indexMeta.x - wrist.x;
  const ay = indexMeta.y - wrist.y;
  const az = indexMeta.z - wrist.z;
  const bx = pinkyMeta.x - wrist.x;
  const by = pinkyMeta.y - wrist.y;
  const bz = pinkyMeta.z - wrist.z;
  // index × pinky points out of the back of a left hand; the right hand is its mirror image.
  const k = hand === 'left' ? -1 : 1;
  outNormal.x = k * (ay * bz - az * by);
  outNormal.y = k * (az * bx - ax * bz);
  outNormal.z = k * (ax * by - ay * bx);
  norm(outNormal);
  outSide.x = pinkyMeta.x - indexMeta.x;
  outSide.y = pinkyMeta.y - indexMeta.y;
  outSide.z = pinkyMeta.z - indexMeta.z;
  norm(outSide);
}

function norm(v: V) {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  v.x /= l;
  v.y /= l;
  v.z /= l;
}

export interface Sample {
  /** The hand or controller has a valid pose this frame. */
  tracked: boolean;
  /** Degrees between the palm normal and the line palm → head (0 for controllers). */
  palmAngle: number;
  /** Degrees between the head's forward and the line head → palm. */
  gazeAngle: number;
  /** Metres from palm to head. */
  distance: number;
}

export const newSample = (): Sample => ({ tracked: false, palmAngle: 180, gazeAngle: 180, distance: 0 });

const scratch: V = { x: 0, y: 0, z: 0 };
const scratch2: V = { x: 0, y: 0, z: 0 };

/** Fill `out` for a palm at `center`; pass `normal = null` for a controller (no palm test). */
export function measure(center: V, normal: V | null, head: V, headFwd: V, out: Sample): void {
  scratch.x = head.x - center.x;
  scratch.y = head.y - center.y;
  scratch.z = head.z - center.z;
  out.distance = Math.hypot(scratch.x, scratch.y, scratch.z);
  out.palmAngle = normal ? angleDeg(normal, scratch) : 0;
  scratch2.x = -scratch.x;
  scratch2.y = -scratch.y;
  scratch2.z = -scratch.z;
  out.gazeAngle = angleDeg(headFwd, scratch2);
  out.tracked = true;
}

export interface Gate {
  shown: boolean;
  /** Seconds the open condition has held continuously. */
  dwell: number;
  /** Seconds since tracking was last valid. */
  lost: number;
}

export const newGate = (): Gate => ({ shown: false, dwell: 0, lost: 0 });

export function resetGate(g: Gate) {
  g.shown = false;
  g.dwell = 0;
  g.lost = 0;
}

/** Advance one frame. Opens after `dwellS` of continuous open-condition; closes outside the looser hold limits. */
export function stepGate(g: Gate, s: Sample, dt: number, dwellS: number): boolean {
  if (!s.tracked) {
    g.lost += dt;
    g.dwell = 0;
    if (g.lost > LOST_GRACE) g.shown = false;
    return g.shown;
  }
  g.lost = 0;
  const hold =
    s.palmAngle < PALM_HOLD && s.gazeAngle < GAZE_HOLD && s.distance >= DIST_HOLD[0] && s.distance <= DIST_HOLD[1];
  if (g.shown) {
    if (!hold) {
      g.shown = false;
      g.dwell = 0;
    }
    return g.shown;
  }
  const show =
    s.palmAngle < PALM_SHOW && s.gazeAngle < GAZE_SHOW && s.distance >= DIST_SHOW[0] && s.distance <= DIST_SHOW[1];
  g.dwell = show ? g.dwell + dt : 0;
  if (show && g.dwell >= dwellS) g.shown = true;
  return g.shown;
}

/** Step to the next/previous entry of a list, wrapping. */
export function cycle<T>(list: readonly T[], cur: T, d: 1 | -1): T {
  const i = list.indexOf(cur);
  return list[(i + d + list.length) % list.length];
}
