import { createSystem, Matrix4, Quaternion, Vector3, type Object3D, type UIKitMLAsset } from '@iwsdk/core';
import { store } from '../app.js';
import {
  measure,
  newGate,
  newSample,
  palmFrame,
  resetGate,
  stepGate,
  type Gate,
  type Hand,
  type Sample,
} from '../hand/palm.js';
import { VRUISystem } from './vr-ui-system.js';

type Kind = 'menu' | 'hud' | 'hub';

const SIDES: Hand[] = ['left', 'right'];
/** WebXR hand joint indices used for the palm frame. */
const J_WRIST = 0;
const J_INDEX_META = 5;
const J_MIDDLE_META = 10;
const J_PINKY_META = 20;

/** Panel width / 2 in metres, plus a gap so the panel clears the holding hand's own fingers. */
const HALF_WIDTH: Record<Kind, number> = { menu: 0.11, hud: 0.09, hub: 0.11 };
const SIDE_GAP = 0.08;
/** Panel is nudged towards the head so it never sinks into the hand. */
const TOWARD_HEAD = 0.03;
const CONTROLLER_LIFT = 0.08;
/** Seconds the open condition must hold before a panel opens. */
const DWELL: Record<Kind, number> = { menu: 0.15, hud: 0.15, hub: 0.15 };
const FADE_IN = 0.15;
const FADE_OUT = 0.25;
/** Position/rotation smoothing, per second (about a 12 Hz cut-off). */
const SMOOTH = 12;
/** Seconds with nothing tracked in the menu before the in-front menu comes back. */
const FALLBACK_AFTER = 5;
const BASE_SCALE = 0.05;
const PARKED_Y = -50;

const KINDS: Kind[] = ['menu', 'hud', 'hub'];
const up = new Vector3(0, 1, 0);

interface Slot {
  panel: UIKitMLAsset | undefined;
  /** 0 hidden … 1 fully shown. */
  alpha: number;
}

/**
 * Puts the menu (mode `menu`) and the paused-session controls (mode `paused`) beside a raised hand.
 * Nothing opens on the hand while a session runs, so resting palms never bring up a panel.
 * The panel opens when a palm faces you and you look at it, follows that hand, and closes when
 * you lower it. With controllers it sits above the raised controller instead.
 * Labels, clicks and text are owned by VRUISystem.
 */
export class HandMenuSystem extends createSystem({}) {
  private slots: Record<Kind, Slot> = {
    menu: { panel: undefined, alpha: 0 },
    hud: { panel: undefined, alpha: 0 },
    hub: { panel: undefined, alpha: 0 },
  };
  private gates: Record<Hand, Gate> = { left: newGate(), right: newGate() };
  private samples: Record<Hand, Sample> = { left: newSample(), right: newSample() };
  /** Latest palm centre / side vector / normal per hand (kept when tracking blips). */
  private centers: Record<Hand, Vector3> = { left: new Vector3(), right: new Vector3() };
  private sideVecs: Record<Hand, Vector3> = { left: new Vector3(), right: new Vector3() };
  private normals: Record<Hand, Vector3> = { left: new Vector3(), right: new Vector3() };
  private holder: Hand | null = null;
  private untrackedFor = 0;
  private lastMode = '';

  private head = new Vector3();
  private fwd = new Vector3();
  private joint = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
  private mat = new Matrix4();
  private target = new Vector3();
  private smooth = new Vector3();
  private toHead = new Vector3();
  private yawQ = new Quaternion();
  private smoothQ = new Quaternion();
  private haveSmooth = false;

  init(): void {
    this.slots.menu.panel = this.world.getSceneObject<UIKitMLAsset>('vr-hand-menu') ?? undefined;
    this.slots.hud.panel = this.world.getSceneObject<UIKitMLAsset>('vr-hand-hud') ?? undefined;
    this.slots.hub.panel = this.world.getSceneObject<UIKitMLAsset>('vr-hand-hub') ?? undefined;
    if (!this.slots.menu.panel || !this.slots.hud.panel || !this.slots.hub.panel) console.warn('[hand-menu] missing scene panel');
    for (const k of KINDS) this.park(k);
  }

  update(delta: number): void {
    const s = store.get();
    const ui = this.world.getSystem(VRUISystem);
    const want: Kind | null = !s.immersive
      ? null
      : s.mode === 'hub'
        ? 'hub'
        : s.mode === 'menu'
          ? 'menu'
          : s.mode === 'paused'
            ? 'hud'
            : null;

    if (s.mode !== this.lastMode) {
      this.lastMode = s.mode;
      this.untrackedFor = 0;
      for (const h of SIDES) resetGate(this.gates[h]);
      this.holder = null;
    }

    if (!want) {
      this.untrackedFor = 0;
      for (const k of KINDS) this.fade(k, false, delta);
      this.holder = null;
      ui?.setFallback(false);
      return;
    }

    this.readHead();
    let anyTracked = false;
    for (const h of SIDES) {
      this.sampleHand(h);
      anyTracked ||= this.samples[h].tracked;
      stepGate(this.gates[h], this.samples[h], delta, DWELL[want]);
    }

    // Nothing tracked for a while in the menu: bring the in-front menu back so you can still start.
    if (want === 'menu') {
      this.untrackedFor = anyTracked ? 0 : this.untrackedFor + delta;
      ui?.setFallback(this.untrackedFor >= FALLBACK_AFTER);
    } else {
      ui?.setFallback(false);
    }

    // The hand already holding the menu keeps it; otherwise the first one that opens.
    if (!this.holder || !this.gates[this.holder].shown) {
      this.holder = this.gates.left.shown ? 'left' : this.gates.right.shown ? 'right' : null;
      this.haveSmooth = false;
    }

    if (this.holder) this.aim(this.holder, want);
    this.fade(want, this.holder !== null && !(ui?.fallbackActive ?? false), delta);
    for (const k of KINDS) if (k !== want) this.fade(k, false, delta);
    if (want === 'menu' && this.slots.menu.alpha > 0.5) ui?.dismissHint();
  }

  private readHead() {
    const head: Object3D = this.player.head;
    head.updateWorldMatrix(true, false);
    head.getWorldPosition(this.head);
    head.getWorldDirection(this.fwd);
    this.fwd.negate(); // the head group looks down −Z; getWorldDirection returns +Z for non-cameras
  }

  /** Fill `samples[hand]` from hand joints (hand tracking) or the grip pose (controllers). */
  private sampleHand(hand: Hand) {
    const smp = this.samples[hand];
    const xr = this.input.xr;
    smp.tracked = false;
    if (!xr) return;
    const grip = this.player.gripSpaces[hand];
    grip.updateWorldMatrix(true, false);

    if (xr.isPrimary('hand', hand)) {
      const jt = xr.visualAdapters.hand[hand].jointTransforms;
      // fillPoses leaves zeros when the hand is not tracked; a valid matrix has w = 1.
      if (!jt || jt[J_WRIST * 16 + 15] !== 1) return;
      const idx = [J_WRIST, J_INDEX_META, J_MIDDLE_META, J_PINKY_META];
      for (let i = 0; i < 4; i++) {
        // Joint matrices are relative to the grip space.
        this.mat.fromArray(jt, idx[i] * 16).premultiply(grip.matrixWorld);
        this.joint[i].setFromMatrixPosition(this.mat);
      }
      palmFrame(this.joint[0], this.joint[1], this.joint[3], hand, this.normals[hand], this.sideVecs[hand]);
      this.centers[hand].copy(this.joint[2]);
      measure(this.centers[hand], this.normals[hand], this.head, this.fwd, smp);
    } else if (xr.getPrimaryInputSource(hand)) {
      this.centers[hand].setFromMatrixPosition(grip.matrixWorld);
      // Pinky side of a palm turned to the face is the inner side: left hand → right of it, and vice versa.
      const k = hand === 'left' ? 1 : -1;
      this.sideVecs[hand].set(-this.fwd.z * k, 0, this.fwd.x * k).normalize();
      measure(this.centers[hand], null, this.head, this.fwd, smp);
    }
  }

  /** Target pose for the panel beside `hand`, eased towards each frame. */
  private aim(hand: Hand, kind: Kind) {
    const c = this.centers[hand];
    const controller = !this.input.xr?.isPrimary('hand', hand);
    this.toHead.copy(this.head).sub(c).normalize();
    this.target
      .copy(c)
      .addScaledVector(this.sideVecs[hand], HALF_WIDTH[kind] + SIDE_GAP)
      .addScaledVector(this.toHead, TOWARD_HEAD);
    if (controller) this.target.addScaledVector(up, CONTROLLER_LIFT);
    // Face the head fully (yaw and pitch) with text kept upright. Panels face +Z, and
    // Matrix4.lookAt(eye, target, up) sets +Z = eye − target, so pass head as the eye.
    this.mat.lookAt(this.head, this.target, up);
    this.yawQ.setFromRotationMatrix(this.mat);
    if (!this.haveSmooth) {
      this.smooth.copy(this.target);
      this.smoothQ.copy(this.yawQ);
      this.haveSmooth = true;
    }
  }

  /** Advance a panel's fade and apply the shared smoothed pose. */
  private fade(kind: Kind, on: boolean, dt: number) {
    const slot = this.slots[kind];
    const p = slot.panel;
    if (!p) return;
    slot.alpha = on
      ? Math.min(1, slot.alpha + dt / FADE_IN)
      : Math.max(0, slot.alpha - dt / FADE_OUT);
    if (slot.alpha <= 0.01) return this.park(kind);
    if (on) {
      const k = 1 - Math.exp(-SMOOTH * dt);
      this.smooth.lerp(this.target, k);
      this.smoothQ.slerp(this.yawQ, k);
    }
    if (!this.haveSmooth) return;
    const e = slot.alpha * slot.alpha * (3 - 2 * slot.alpha);
    p.visible = true;
    p.position.copy(this.smooth);
    p.quaternion.copy(this.smoothQ);
    p.scale.setScalar(BASE_SCALE * (0.6 + 0.4 * e));
  }

  private park(kind: Kind) {
    const slot = this.slots[kind];
    slot.alpha = 0;
    const p = slot.panel;
    if (!p) return;
    p.visible = false;
    p.position.set(0, PARKED_Y, 0);
  }
}
