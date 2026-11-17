import {
  Group,
  HalfFloatType,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  type Object3D,
  type Scene,
  Vector3,
  WebGLRenderTarget,
  type WebGLRenderer,
} from '@iwsdk/core';

/** Picture size on the screen, metres (16:9). */
const W = 0.26;
const H = (W * 9) / 16;
const BORDER = 0.008;
/** Render target resolution. */
const RT_W = 640;
const RT_H = 360;
/** Vertical field of view of the preview camera, degrees (about the view straight ahead). */
const FOV = 50;
/** Seconds to fade the screen in / out. */
const FADE = 0.15;
/** Seconds the screen stays up after the turning stops, so the result can be seen. */
const LINGER = 0.6;

const eye = new Vector3();
const look = new Vector3();

/**
 * A small 16:9 screen that floats over the dial while it is being turned and shows a
 * first-person view straight ahead, so the user sees how the surroundings will change.
 * The owner decides what the scene looks like for the preview (`render`'s before/after).
 */
export class PreviewScreen {
  readonly group = new Group();
  private readonly rt = new WebGLRenderTarget(RT_W, RT_H, { type: HalfFloatType, depthBuffer: true });
  private readonly cam = new PerspectiveCamera(FOV, RT_W / RT_H, 0.05, 500);
  private readonly picMat: MeshBasicMaterial;
  private readonly frameMat: MeshBasicMaterial;
  private readonly geos: PlaneGeometry[] = [];
  /** 0..1 shown amount. */
  private k = 0;
  private idle = LINGER;

  constructor() {
    this.group.name = 'PreviewScreen';
    this.picMat = new MeshBasicMaterial({ map: this.rt.texture, transparent: true, opacity: 0, depthWrite: false });
    this.frameMat = new MeshBasicMaterial({ color: 0x0b0c0f, transparent: true, opacity: 0, depthWrite: false });
    const picGeo = new PlaneGeometry(W, H);
    const frameGeo = new PlaneGeometry(W + BORDER * 2, H + BORDER * 2);
    this.geos.push(picGeo, frameGeo);
    const frame = new Mesh(frameGeo, this.frameMat);
    frame.name = 'PreviewFrame';
    frame.renderOrder = 10;
    const pic = new Mesh(picGeo, this.picMat);
    pic.name = 'PreviewPicture';
    pic.position.z = 0.001;
    pic.renderOrder = 11;
    // Not a pointer target: rays pass through to the dial and windows.
    const noRay = () => {};
    frame.raycast = noRay;
    pic.raycast = noRay;
    this.group.add(frame, pic);
    this.group.visible = false;
  }

  /** True while the screen is (at least partly) up. */
  get visible(): boolean {
    return this.k > 0;
  }

  /**
   * Advance the fade. `active` = the dial is being turned this frame. Faces `viewer` (world).
   * Returns true when the preview should be rendered this frame.
   */
  step(active: boolean, dt: number, viewer: Vector3): boolean {
    this.idle = active ? 0 : this.idle + dt;
    const want = this.idle < LINGER ? 1 : 0;
    if (this.k !== want) {
      this.k = want > this.k ? Math.min(1, this.k + dt / FADE) : Math.max(0, this.k - dt / FADE);
    }
    const on = this.k > 0;
    this.group.visible = on;
    if (!on) return false;
    const e = this.k * this.k * (3 - 2 * this.k);
    this.picMat.opacity = e;
    this.frameMat.opacity = e * 0.85;
    this.group.scale.setScalar(0.85 + 0.15 * e);
    this.group.lookAt(viewer);
    return true;
  }

  /** Hide immediately (e.g. when the dial is put away). */
  reset() {
    this.k = 0;
    this.idle = LINGER;
    this.group.visible = false;
  }

  /**
   * Render the first-person view from `viewer` (world position), looking along world −Z,
   * into the screen. `hide` (the dial, which holds this screen) is hidden while rendering.
   */
  render(renderer: WebGLRenderer, scene: Scene, viewer: Vector3, hide: Object3D) {
    eye.copy(viewer);
    this.cam.position.copy(eye);
    look.set(eye.x, eye.y, eye.z - 1);
    this.cam.lookAt(look);
    this.cam.updateMatrixWorld();

    const wasVisible = hide.visible;
    hide.visible = false;
    const xrEnabled = renderer.xr.enabled;
    const prevTarget = renderer.getRenderTarget();
    const shadowAuto = renderer.shadowMap.autoUpdate;
    // Render as a plain camera even inside an XR frame (same as three's Reflector).
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(scene, this.cam);
    renderer.setRenderTarget(prevTarget);
    renderer.shadowMap.autoUpdate = shadowAuto;
    renderer.xr.enabled = xrEnabled;
    hide.visible = wasVisible;
  }

  dispose() {
    this.rt.dispose();
    this.picMat.dispose();
    this.frameMat.dispose();
    for (const g of this.geos) g.dispose();
  }
}
