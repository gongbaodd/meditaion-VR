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
import { COUNT, detentOffset, KNOB_DEG_PER_DETENT, ringXZ, STEP_DEG, windowAngleDeg, windowFade, windowGlow, wrapPi } from '../hub/ring.js';
import { makePaneMaterial } from '../hub/window-material.js';
import { getLang, onLangChange, t } from '../i18n/index.js';
import { PLACES } from '../state.js';
import { vrFontFamilies } from '../ui/vr-font.js';
import { PlaceSystem } from './place-system.js';

const D2R = Math.PI / 180;
const RING_R = 3;
const LABEL_R = 2.6;
const LABEL_Y = 0.2;
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

const tmpQ = new Quaternion();
const fwd = new Vector3();
const up = new Vector3();
const ref = new Vector3();
const cross = new Vector3();
const WORLD_UP = new Vector3(0, 1, 0);
const aim = new Vector3();
const toDial = new Vector3();
const dialPos = new Vector3();
const raySrc = new Vector3();
const hexColor = new Color();

/**
 * The VR hub: a ring of arched place windows and a dial that turns it.
 * `value` is the continuous dial position in detents; window i is dead ahead at value = i.
 * Twisting the controller/hand (roll about the pointing axis) while pressing the dial turns it;
 * on release it eases to the nearest detent. Thumbstick left/right steps one place; selecting
 * a side window brings it to the front; selecting the front window enters the place.
 */
export class HubSystem extends createSystem({}) {
  private wins: Win[] = [];
  private dial!: Object3D;
  private knob: Object3D | undefined;
  private title!: UIKitMLAsset;
  private floor!: Object3D;
  private value = 0;
  private snap: number | null = null;
  private lastDetent = 0;
  private shown = false;
  private ready = false;
  private dragging = false;
  private dragHand: 'left' | 'right' = 'right';
  private lastRoll = 0;
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
    this.cleanupFuncs.push(() => {
      dial.removeEventListener('pointerdown', down as never);
      dial.removeEventListener('pointerup', upEv as never);
      dial.removeEventListener('pointercancel', upEv as never);
    });

    actions.openHub = () => this.openHub();

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
    this.lastDetent = Math.round(this.value);
    this.ready = true;
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
    this.world.getSystem(PlaceSystem)?.setLevel(0, 0.5);
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
    const a = windowAngleDeg(i, this.value);
    if (Math.abs(a) < STEP_DEG / 2) {
      this.enter(i);
    } else {
      const base = Math.round(this.value);
      this.snap = base + detentOffset(i, base);
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
    // Pick the hand whose ray points most nearly at the dial.
    const rs = this.player.raySpaces;
    this.dial.getWorldPosition(dialPos);
    let best: 'left' | 'right' = 'right';
    let bestD = Infinity;
    for (const hand of ['left', 'right'] as const) {
      const r = rs[hand];
      if (!r) continue;
      r.getWorldPosition(raySrc);
      r.getWorldQuaternion(tmpQ);
      aim.set(0, 0, -1).applyQuaternion(tmpQ);
      toDial.copy(dialPos).sub(raySrc);
      const d = toDial.sub(aim.multiplyScalar(toDial.dot(aim))).length();
      if (d < bestD) {
        bestD = d;
        best = hand;
      }
    }
    void e;
    this.dragHand = best;
    this.dragging = true;
    this.snap = null;
    this.lastRoll = this.roll();
  }

  private endDrag() {
    if (!this.dragging) return;
    this.dragging = false;
    this.snap = Math.round(this.value);
  }

  /** Roll of the active ray space about its pointing axis, radians. NaN when pointing straight up/down. */
  private roll(): number {
    const r = this.player.raySpaces[this.dragHand];
    if (!r) return NaN;
    r.getWorldQuaternion(tmpQ);
    fwd.set(0, 0, -1).applyQuaternion(tmpQ);
    up.set(0, 1, 0).applyQuaternion(tmpQ);
    if (Math.abs(fwd.y) > 0.92) return NaN;
    ref.copy(WORLD_UP).addScaledVector(fwd, -WORLD_UP.dot(fwd)).normalize();
    cross.crossVectors(ref, up);
    return Math.atan2(fwd.dot(cross), ref.dot(up));
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
      const r = this.roll();
      if (!Number.isNaN(r) && !Number.isNaN(this.lastRoll)) {
        this.value += wrapPi(r - this.lastRoll) / (KNOB_DEG_PER_DETENT * D2R);
      }
      if (!Number.isNaN(r)) this.lastRoll = r;
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

    const det = Math.round(this.value);
    if (det !== this.lastDetent) {
      this.lastDetent = det;
      audio.tick();
    }

    if (this.knob) this.knob.rotation.y = -this.value * KNOB_DEG_PER_DETENT * D2R;

    for (let i = 0; i < COUNT; i++) this.layout(i);
  }

  private step(d: number) {
    this.snap = (this.snap ?? Math.round(this.value)) + d;
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
      this.snap = (this.snap ?? Math.round(this.value)) + (x > 0 ? 1 : -1);
    }
  }

  private layout(i: number) {
    const w = this.wins[i];
    if (!w) return;
    const a = windowAngleDeg(i, this.value);
    const fade = windowFade(a);
    const glow = windowGlow(a);
    const on = fade > 0.02;

    w.obj.visible = on;
    w.label.visible = on;
    if (!on) {
      w.obj.position.y = PARKED_Y;
      w.label.position.y = PARKED_Y;
      return;
    }
    const [x, z] = ringXZ(a, RING_R);
    w.obj.position.set(x, 0, z);
    w.obj.rotation.y = -a * D2R;
    // Don't let a nearly-invisible window catch rays.
    if (fade < 0.3) w.obj.position.y = PARKED_Y;

    const [lx, lz] = ringXZ(a, LABEL_R);
    w.label.position.set(lx, LABEL_Y, lz);
    w.label.rotation.set(-0.35, -a * D2R, 0, 'YXZ');
    w.label.scale.setScalar(LABEL_SCALE * (0.55 + 0.45 * fade) * (1 + 0.12 * glow));

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
