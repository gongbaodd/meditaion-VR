import {
  AssetManager,
  Color,
  createSystem,
  type Mesh,
  MeshBasicMaterial,
  type Object3D,
  Quaternion,
  SRGBColorSpace,
  type ShaderMaterial,
  type Texture,
  type UIKit,
  type UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import { actions, audio, publicUrl, store } from '../app.js';
import { COUNT, type DeckSlot, mod, deckSlot, detentOffset, KNOB_DEG_PER_DETENT, type Spring, stepSpring, stepTarget, wrapPi } from '../hub/ring.js';
import { makePaneMaterial } from '../hub/window-material.js';
import { getLang, onLangChange, t } from '../i18n/index.js';
import { PLACES } from '../state.js';
import { vrFontFamilies } from '../ui/vr-font.js';
import { PlaceSystem } from './place-system.js';
import { VRUISystem } from './vr-ui-system.js';

const D2R = Math.PI / 180;
/** The front window's name sits this far toward the player from the window, and this high. */
const LABEL_NEAR = 0.4;
const LABEL_Y = 0.2;
/** Seconds the windows take to settle on a new place (critically damped, no overshoot). */
const STEP_TIME = 0.16;
/** Longest frame the eased step will integrate, so a hitch cannot make it jump. */
const MAX_DT = 0.05;
const LABEL_SCALE = 0.1;
const PARKED_Y = -50;

interface Win {
  obj: Object3D;
  label: UIKitMLAsset;
  paneMat: ShaderMaterial;
  outlineMat: MeshBasicMaterial;
  glowMat: MeshBasicMaterial;
  floorMat: MeshBasicMaterial;
  haloMeshes: Mesh[];
  floorGlow: Mesh;
  color: Color;
  lastGlowStep: number;
}

/** Handle circle radius on the dial plate (matches HANDLE_R in hub-dial.scene-asset.ts), metres. */
const HANDLE_R = 0.082;
/** How close (metres, on the plate) a press must land to the handle to start a drag. */
const GRAB_RADIUS = 0.06;
const HANDLE_IDLE = 0x8a90a0;
const HANDLE_HOVER = 0xe8eaf0;

const slotTmp: DeckSlot = { x: 0, depth: 0, fade: 0, glow: 0 };
const tmpQ = new Quaternion();
const aim = new Vector3();
const plateN = new Vector3();
const toPlate = new Vector3();
const plateHit = new Vector3();
const plateCenter = new Vector3();
const raySrc = new Vector3();
const hexColor = new Color();
const handleColor = new Color();

/**
 * The VR hub: a stack of arched place windows and a dial that changes which one is in front.
 * `value` is the continuous knob position in detents; window i is dead ahead at value = i.
 * The windows do not follow the knob directly: `target` is the detent they should show and
 * `view` chases it with an eased spring, so one step is a short calm move whatever the hand does.
 * Press the handle on the dial's rim (ray trigger or hand pinch) and drag it around the plate:
 * the handle follows where the ray crosses the plate. On release it eases to the nearest
 * detent. Thumbstick left/right steps one place; selecting
 * a side window brings it to the front; selecting the front window enters the place.
 */
export class HubSystem extends createSystem({}) {
  private wins: Win[] = [];
  private dial!: Object3D;
  private knob: Object3D | undefined;
  private head!: Object3D;
  private handleMat: MeshBasicMaterial | undefined;
  private haloMesh: Mesh | undefined;
  private handleMesh: Mesh | undefined;
  private hovering = false;
  private title!: UIKitMLAsset;
  private floor!: Object3D;
  private value = 0;
  /** Detent the windows are heading for (unwrapped, like `value`). */
  private target = 0;
  /** Eased window position in detents; `x` is what the layout reads. */
  private view: Spring = { x: 0, v: 0 };
  private snap: number | null = null;
  private lastDetent = 0;
  private shown = false;
  private ready = false;
  private dragging = false;
  private dragHand: 'left' | 'right' = 'right';
  /** The pointer and object holding pointer capture for the current drag, so the ray stays on the dial. */
  private capture: { obj: Object3D; id: number } | null = null;
  /** Plate angle (radians, atan2(x, z) in the dial head's frame) of the ray hit last frame. */
  private lastAng = 0;
  private stickLatched = false;
  private lastWheel = 0;

  init(): void {
    const dial = this.world.getSceneObject('hub-dial');
    const floor = this.world.getSceneObject('hub-floor');
    const title = this.world.getSceneObject<UIKitMLAsset>('hub-title');
    if (!dial || !floor || !title) {
      console.warn('[hub] scene nodes missing');
      return;
    }
    this.dial = dial;
    this.floor = floor;
    this.title = title;
    this.knob = dial.getObjectByName('Knob') ?? undefined;
    this.head = dial.getObjectByName('Head') ?? dial;
    const handle = dial.getObjectByName('Handle') as Mesh | undefined;
    this.handleMesh = handle;
    if (handle) {
      // Materials are shared between clones; give this dial its own.
      this.handleMat = (handle.material as MeshBasicMaterial).clone();
      handle.material = this.handleMat;
    }
    this.haloMesh = (dial.getObjectByName('HandleHalo') as Mesh | undefined) ?? undefined;
    if (this.haloMesh) {
      this.haloMesh.material = (this.haloMesh.material as MeshBasicMaterial).clone();
    }
    title.document.rootElement.setProperties({ fontFamilies: vrFontFamilies(), fontFamily: 'ui' } as never);

    PLACES.forEach((place, i) => {
      const obj = this.world.getSceneObject(`hub-win-${i}`);
      const label = this.world.getSceneObject<UIKitMLAsset>(`hub-label-${i}`);
      if (!obj || !label) return console.warn(`[hub] window ${i} missing`);
      label.document.rootElement.setProperties({ fontFamilies: vrFontFamilies(), fontFamily: 'ui' } as never);

      // Materials are shared between clones; give this window its own.
      const named = (n: string) => obj.getObjectByName(n) as Mesh;
      const outline = named('Outline');
      const pane = named('Pane');
      const outlineMat = (outline.material as MeshBasicMaterial).clone();
      outline.material = outlineMat;
      const glowMat = (named('HaloA').material as MeshBasicMaterial).clone();
      const haloMeshes = ['HaloA', 'HaloB', 'HaloC'].map((n) => named(n));
      const floorGlow = named('FloorGlow');
      for (const m of haloMeshes) m.material = glowMat;
      const floorMat = glowMat.clone();
      floorGlow.material = floorMat;
      glowMat.color.set(place.color);
      floorMat.color.set(place.color);
      const color = new Color(place.color);
      const w: Win = {
        obj,
        label,
        paneMat: null as unknown as ShaderMaterial,
        outlineMat,
        glowMat,
        floorMat,
        haloMeshes,
        floorGlow,
        color,
        lastGlowStep: -1,
      };
      this.wins[i] = w;

      // Thumbnail through the window.
      AssetManager.loadTexture(publicUrl(`hdri/${place.id}_thumb.jpg`))
        .then((tex: Texture) => {
          tex.colorSpace = SRGBColorSpace;
          w.paneMat = makePaneMaterial(tex, place.focusU, place.color);
          pane.material = w.paneMat;
        })
        .catch((e: unknown) => console.warn(`[hub] thumbnail ${place.id}`, e));

      const onClick = () => this.onWindowClick(i);
      obj.addEventListener('click', onClick);
      this.cleanupFuncs.push(() => obj.removeEventListener('click', onClick));
    });

    // Dial press / release.
    const down = (e: unknown) => this.beginDrag(e);
    const upEv = () => this.endDrag();
    dial.addEventListener('pointerdown', down as never);
    dial.addEventListener('pointerup', upEv as never);
    dial.addEventListener('pointercancel', upEv as never);
    const enter = () => (this.hovering = true);
    const leave = () => (this.hovering = false);
    dial.addEventListener('pointerenter', enter as never);
    dial.addEventListener('pointerleave', leave as never);
    this.cleanupFuncs.push(() => {
      dial.removeEventListener('pointerenter', enter as never);
      dial.removeEventListener('pointerleave', leave as never);
      dial.removeEventListener('pointerdown', down as never);
      dial.removeEventListener('pointerup', upEv as never);
      dial.removeEventListener('pointercancel', upEv as never);
    });

    // In VR the ray usually leaves the dial while dragging; end the drag on the drag hand's
    // select release wherever it points, so letting go always lets go.
    const xr = this.world.renderer.xr;
    const selectEnd = (e: XRInputSourceEvent) => {
      if (this.dragging && e.inputSource.handedness === this.dragHand) this.endDrag();
    };
    const onSession = () => xr.getSession()?.addEventListener('selectend', selectEnd);
    const offSession = () => {
      xr.getSession()?.removeEventListener('selectend', selectEnd);
      this.endDrag();
    };
    xr.addEventListener('sessionstart', onSession);
    xr.addEventListener('sessionend', offSession);
    onSession();
    this.cleanupFuncs.push(() => {
      xr.removeEventListener('sessionstart', onSession);
      xr.removeEventListener('sessionend', offSession);
      xr.getSession()?.removeEventListener('selectend', selectEnd);
    });

    actions.openHub = () => this.openHub();
    actions.stepHub = (d) => this.step(d);
    actions.enterHub = () => this.enter(this.frontIndex());

    // Desktop: drag the dial sideways, arrow keys or mouse wheel step the ring.
    const canvas = this.world.renderer.domElement;
    const move = (e: PointerEvent) => {
      if (this.dragging && !store.get().immersive) this.value += e.movementX / 140;
    };
    const upW = () => this.endDrag();
    const wheel = (e: WheelEvent) => {
      if (!this.shown || store.get().immersive) return;
      const now = performance.now();
      if (now - this.lastWheel < 160 || Math.abs(e.deltaY) < 1) return;
      this.lastWheel = now;
      this.step(e.deltaY > 0 ? 1 : -1);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', upW);
    canvas.addEventListener('wheel', wheel, { passive: true });
    this.cleanupFuncs.push(() => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', upW);
      canvas.removeEventListener('wheel', wheel);
    });

    this.relabel();
    this.cleanupFuncs.push(
      onLangChange(() => this.relabel()),
      store.subscribe((s, prev) => this.onStore(s, prev)),
    );
    this.value = Math.max(0, PLACES.findIndex((p) => p.id === store.get().prefs.place));
    this.target = Math.round(this.value);
    this.view.x = this.target;
    this.view.v = 0;
    this.lastDetent = this.target;
    this.ready = true;
    this.world.getSystem(VRUISystem)?.setHubPlace(this.frontIndex());
    this.setShown(false);
    if (store.get().mode === 'hub') this.world.getSystem(PlaceSystem)?.setLevel(0, 0);
  }

  private relabel() {
    const lang = getLang();
    PLACES.forEach((p, i) => this.wins[i]?.label.getElementById<UIKit.Text>('name')?.setProperties({ text: p.name[lang] }));
    this.title.getElementById<UIKit.Text>('hub-title')?.setProperties({ text: t('app.title') });
    this.title
      .getElementById<UIKit.Text>('hub-hint')
      ?.setProperties({ text: t(store.get().immersive ? 'hub.hint' : 'hub.hintDesktop') });
  }

  private onStore(s: ReturnType<typeof store.get>, prev: ReturnType<typeof store.get>) {
    // Entering VR from the start menu lands in the hub; leaving VR leaves it.
    if (s.immersive !== prev.immersive) this.relabel();
    if (s.immersive && !prev.immersive && s.mode === 'menu') {
      this.openHub();
    }
  }

  /** Called by the "Change place" button and when VR starts. */
  openHub() {
    const i = PLACES.findIndex((p) => p.id === store.get().prefs.place);
    this.value = Math.round(this.value) + detentOffset(Math.max(0, i), Math.round(this.value));
    this.snap = this.value;
    this.target = this.value;
    this.view.x = this.value;
    this.view.v = 0;
    this.lastDetent = this.value;
    this.world.getSystem(PlaceSystem)?.setLevel(0, 0.5);
    this.world.getSystem(VRUISystem)?.setHubPlace(this.frontIndex());
    store.set({ mode: 'hub' });
  }

  private enter(i: number) {
    const place = PLACES[i];
    store.setPrefs({ place: place.id, ambient: place.ambient });
    this.world.getSystem(PlaceSystem)?.setLevel(1, 1.5);
    store.set({ mode: 'menu' });
  }

  private onWindowClick(i: number) {
    if (!this.shown || this.dragging) return;
    void audio.unlock();
    if (Math.abs(detentOffset(i, this.view.x)) < 0.5) {
      this.enter(i);
    } else {
      this.snap = this.target + detentOffset(i, this.target);
    }
  }

  // ---- dial ----------------------------------------------------------------------------

  private beginDrag(e: unknown) {
    if (!this.shown) return;
    void audio.unlock();
    if (!store.get().immersive) {
      this.dragging = true;
      this.snap = null;
      return;
    }
    // Pick the hand whose ray lands closest to the handle; ignore presses elsewhere on the dial.
    const a0 = Math.PI - this.value * KNOB_DEG_PER_DETENT * D2R;
    const hx = Math.sin(a0) * HANDLE_R;
    const hz = Math.cos(a0) * HANDLE_R;
    let best: 'left' | 'right' | null = null;
    let bestD = GRAB_RADIUS;
    let bestAng = 0;
    for (const hand of ['left', 'right'] as const) {
      const ang = this.plateAngle(hand);
      if (Number.isNaN(ang)) continue;
      const d = Math.hypot(plateHit.x - hx, plateHit.z - hz);
      if (d < bestD) {
        bestD = d;
        best = hand;
        bestAng = ang;
      }
    }
    if (!best) return;
    this.dragHand = best;
    this.dragging = true;
    this.snap = null;
    this.lastAng = bestAng;
    // Capture the pointer: while held, the ray only intersects the dial (no hover/clicks on
    // the windows behind it) and its release is delivered here even if the ray drifts off.
    const ev = e as { pointerId?: number; target?: Object3D };
    if (ev.target && typeof ev.pointerId === 'number') {
      ev.target.setPointerCapture(ev.pointerId);
      this.capture = { obj: ev.target, id: ev.pointerId };
    }
  }

  private endDrag() {
    if (this.capture) {
      const { obj, id } = this.capture;
      this.capture = null;
      if (obj.hasPointerCapture(id)) obj.releasePointerCapture(id);
    }
    if (!this.dragging) return;
    this.dragging = false;
    this.snap = this.target;
  }

  /**
   * Where a hand's ray crosses the dial plate: returns the angle around the plate centre
   * (atan2(x, z) in the head's frame, so 0 = near edge) and leaves the hit in `plateHit`
   * (head-local). NaN when the ray is parallel to the plate or points away from it.
   */
  private plateAngle(hand: 'left' | 'right'): number {
    const r = this.player.raySpaces[hand];
    if (!r) return NaN;
    r.getWorldPosition(raySrc);
    r.getWorldQuaternion(tmpQ);
    aim.set(0, 0, -1).applyQuaternion(tmpQ);
    this.head.getWorldPosition(plateCenter);
    this.head.getWorldQuaternion(tmpQ);
    plateN.set(0, 1, 0).applyQuaternion(tmpQ);
    const denom = aim.dot(plateN);
    if (Math.abs(denom) < 0.05) return NaN;
    const t = toPlate.copy(plateCenter).sub(raySrc).dot(plateN) / denom;
    if (t < 0) return NaN;
    plateHit.copy(raySrc).addScaledVector(aim, t);
    this.head.worldToLocal(plateHit);
    return Math.atan2(plateHit.x, plateHit.z);
  }

  // ---- frame ---------------------------------------------------------------------------

  private setShown(on: boolean) {
    this.shown = on;
    if (on) return;
    for (const w of this.wins) {
      if (!w) continue;
      w.obj.visible = false;
      w.obj.position.y = PARKED_Y;
      w.label.visible = false;
      w.label.position.y = PARKED_Y;
    }
    this.dial.visible = false;
    this.dial.position.y = PARKED_Y;
    this.floor.visible = false;
    this.title.visible = false;
    this.title.position.y = PARKED_Y;
  }

  update(delta: number): void {
    if (!this.ready) return;
    const s = store.get();
    const want = s.mode === 'hub';
    if (want !== this.shown) {
      this.setShown(want);
      if (want) {
        this.shown = true;
        this.dial.visible = true;
        this.floor.visible = true;
        this.title.visible = true;
        this.dial.position.set(0, 0, -0.45);
        this.title.position.set(0, 2.0, -3.2);
      }
    }
    if (!want) return;

    if (this.dragging && !s.immersive) {
      // desktop: value is driven by pointer movement
    } else if (this.dragging) {
      // The handle follows the ray: turning the plate angle by +d lowers the dial value by d.
      const ang = this.plateAngle(this.dragHand);
      if (!Number.isNaN(ang)) {
        this.value -= wrapPi(ang - this.lastAng) / (KNOB_DEG_PER_DETENT * D2R);
        this.lastAng = ang;
      }
    } else {
      this.stickStep();
      if (this.snap !== null) {
        this.value += (this.snap - this.value) * Math.min(1, delta * 10);
        if (Math.abs(this.snap - this.value) < 0.002) {
          this.value = this.snap;
          this.snap = null;
        }
      }
    }

    // The windows only change place once the knob is clearly past halfway, then ease there.
    if (this.dragging) this.target = stepTarget(this.value, this.target);
    else if (this.snap !== null) this.target = this.snap;
    if (this.target !== this.lastDetent) {
      this.lastDetent = this.target;
      audio.tick();
      this.world.getSystem(VRUISystem)?.setHubPlace(this.frontIndex());
    }
    stepSpring(this.view, this.target, STEP_TIME, Math.min(delta, MAX_DT));

    if (this.knob) this.knob.rotation.y = Math.PI - this.value * KNOB_DEG_PER_DETENT * D2R;
    this.styleHandle(this.target);

    for (let i = 0; i < COUNT; i++) this.layout(i);
  }

  /** Grey when idle, brighter when pointed at, the front place's colour (with a halo) while held. */
  private styleHandle(detent: number) {
    if (!this.handleMat) return;
    if (this.dragging) {
      handleColor.set(PLACES[((detent % COUNT) + COUNT) % COUNT].color);
    } else {
      handleColor.set(this.hovering ? HANDLE_HOVER : HANDLE_IDLE);
    }
    this.handleMat.color.lerp(handleColor, 0.25);
    if (this.haloMesh) {
      this.haloMesh.visible = this.dragging;
      (this.haloMesh.material as MeshBasicMaterial).color.copy(this.handleMat.color);
    }
    const scale = this.dragging ? 1.25 : this.hovering ? 1.15 : 1;
    this.handleMesh?.scale.setScalar(scale);
  }

  /** Index of the place whose window the ring is heading for. */
  private frontIndex() {
    return mod(Math.round(this.target));
  }

  private step(d: number) {
    this.snap = (this.snap ?? this.target) + d;
  }

  private stickStep() {
    const kb = this.input.keyboard;
    if (kb?.getKeyDown('ArrowRight')) this.step(1);
    else if (kb?.getKeyDown('ArrowLeft')) this.step(-1);
    if (!store.get().immersive) return;
    const pads = this.input.xr.gamepads;
    let x = 0;
    for (const hand of ['left', 'right'] as const) {
      const v = pads[hand]?.getAxesValues('xr-standard-thumbstick' as never) as { x: number } | undefined;
      if (v && Math.abs(v.x) > Math.abs(x)) x = v.x;
    }
    if (Math.abs(x) < 0.4) this.stickLatched = false;
    else if (!this.stickLatched && Math.abs(x) > 0.7) {
      this.stickLatched = true;
      this.snap = (this.snap ?? this.target) + (x > 0 ? 1 : -1);
    }
  }

  private layout(i: number) {
    const w = this.wins[i];
    if (!w) return;
    const { x, depth, fade, glow } = deckSlot(detentOffset(i, this.view.x), slotTmp);
    const on = fade > 0.02;

    w.obj.visible = on;
    // Only the front window shows its name; it grows in as the window arrives.
    const showLabel = glow > 0.05;
    w.label.visible = on && showLabel;
    if (!on) {
      w.obj.position.y = PARKED_Y;
      w.label.position.y = PARKED_Y;
      return;
    }
    // Every window faces the player.
    const yaw = -Math.atan2(x, depth);
    w.obj.position.set(x, 0, -depth);
    w.obj.rotation.y = yaw;
    // Don't let a nearly-invisible window catch rays.
    if (fade < 0.3) w.obj.position.y = PARKED_Y;

    if (showLabel) {
      w.label.position.set(x, LABEL_Y, -depth + LABEL_NEAR);
      w.label.rotation.set(-0.35, yaw, 0, 'YXZ');
      w.label.scale.setScalar(LABEL_SCALE * glow);
    } else {
      w.label.position.y = PARKED_Y;
    }

    if (w.paneMat) {
      w.paneMat.uniforms.uGlow.value = glow;
      w.paneMat.uniforms.uFade.value = fade;
    }
    w.outlineMat.color.set(0xe8eaf0).lerp(w.color, glow);
    w.outlineMat.opacity = fade * (0.45 + 0.55 * glow);
    w.outlineMat.transparent = true;
    w.glowMat.opacity = fade * glow * 0.09;
    w.floorMat.opacity = fade * glow * 0.3;
    for (const m of w.haloMeshes) m.visible = glow > 0.01;
    w.floorGlow.visible = glow > 0.01;

    // Label chip border follows the glow (update in coarse steps, it allocates a string).
    const step = Math.round(glow * 16);
    if (step !== w.lastGlowStep) {
      w.lastGlowStep = step;
      hexColor.set(0xe8eaf0).lerp(w.color, glow);
      w.label.getElementById<UIKit.Text>('name')?.parentContainer.value?.setProperties({ borderColor: `#${hexColor.getHexString()}` });
    }
  }
}
