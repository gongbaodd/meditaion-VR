import {
  AdditiveBlending,
  CanvasTexture,
  createSystem,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
} from '@iwsdk/core';
import type { BreathPattern } from '../session/types.js';
import { placeInFront } from './placement.js';

export type BreathPhase = 'in' | 'hold-in' | 'out' | 'hold-out';

/** Where in a breath cycle we are, given elapsed seconds. Exported for tests. */
export function breathAt(pattern: BreathPattern, t: number): { phase: BreathPhase; fill: number } {
  const [i, h1, o, h2] = pattern;
  const cycle = i + h1 + o + h2;
  let x = ((t % cycle) + cycle) % cycle;
  if (x < i) return { phase: 'in', fill: ease(x / i) };
  x -= i;
  if (x < h1) return { phase: 'hold-in', fill: 1 };
  x -= h1;
  if (x < o) return { phase: 'out', fill: 1 - ease(x / o) };
  return { phase: 'hold-out', fill: 0 };
}

const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);

/** Gentle untimed pulse used when no pattern is set (natural breathing). */
const NATURAL: BreathPattern = [5, 0, 6, 0];

function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,240,215,0.55)');
  grd.addColorStop(0.6, 'rgba(255,220,180,0.12)');
  grd.addColorStop(1, 'rgba(255,220,180,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

/**
 * A soft light that grows on the in-breath and fades on the out-breath.
 * World-locked (never follows the head) and placed ~1.6 m ahead, slightly below eye level.
 */
export class BreathOrbSystem extends createSystem({}) {
  private group!: Group;
  private core!: Mesh;
  private halo!: Sprite;
  private coreMat!: MeshBasicMaterial;
  private haloMat!: SpriteMaterial;
  private pattern: BreathPattern | null = null;
  private t = 0;
  private visible = false;
  private opacity = 0;
  private fill = 0.3;
  private frozen = false;
  phase: BreathPhase = 'in';

  init(): void {
    this.group = new Group();
    this.coreMat = new MeshBasicMaterial({ color: 0xfff1dc, transparent: true, opacity: 0, depthWrite: false });
    this.core = new Mesh(new SphereGeometry(0.05, 32, 16), this.coreMat);
    this.haloMat = new SpriteMaterial({
      map: glowTexture(),
      color: 0xffe2bd,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.halo = new Sprite(this.haloMat);
    this.group.add(this.halo, this.core);
    this.group.visible = false;
    this.world.createTransformEntity(this.group);
  }

  /** Re-anchor in front of the viewer (call when a session starts). */
  anchor() {
    placeInFront(this.world, this.group, 1.6, -0.2);
  }

  setPattern(p: BreathPattern | null) {
    this.pattern = p;
    this.t = 0;
  }

  setVisible(v: boolean) {
    this.visible = v;
  }

  /** Stop the animation where it is (pause). */
  freeze(f: boolean) {
    this.frozen = f;
  }

  reset() {
    this.visible = false;
    this.opacity = 0;
    this.pattern = null;
    this.group.visible = false;
  }

  update(delta: number): void {
    const target = this.visible ? 1 : 0;
    if (this.opacity !== target) {
      const k = delta / 1.5;
      this.opacity = target > this.opacity ? Math.min(1, this.opacity + k) : Math.max(0, this.opacity - k);
    }
    this.group.visible = this.opacity > 0.001;
    if (!this.group.visible) return;
    if (!this.frozen) this.t += delta;

    const paced = this.pattern != null;
    const b = breathAt(this.pattern ?? NATURAL, this.t);
    this.phase = b.phase;
    // Smooth toward the target so pattern switches don't jump.
    this.fill += (b.fill - this.fill) * Math.min(1, delta * 6);
    const amp = paced ? 1 : 0.35;
    const s = 1 + this.fill * amp * 1.4;
    this.core.scale.setScalar(s);
    const haloSize = 0.45 + this.fill * amp * 0.55;
    this.halo.scale.set(haloSize, haloSize, 1);
    const glow = paced ? 0.55 + 0.45 * this.fill : 0.6;
    this.coreMat.opacity = this.opacity * (0.75 + 0.25 * this.fill);
    this.haloMat.opacity = this.opacity * glow;
  }
}
