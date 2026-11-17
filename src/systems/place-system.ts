import {
  AssetManager,
  createSystem,
  DomeTexture,
  IBLTexture,
  SRGBColorSpace,
  VisibilityState,
  type Entity,
  type Texture,
} from '@iwsdk/core';
import { publicUrl, store } from '../app.js';
import { PLACES, type Place } from '../state.js';

const FADE_OUT = 0.7;
const FADE_IN = 1.6;
/**
 * Turning with the dial never rotates the visible panorama (comfort): while the dial is held
 * only the knob moves; on release the surroundings fade out, take the new yaw, and fade back in.
 */
const TURN_FADE_OUT = 0.2;
const TURN_FADE_IN = 0.45;
/** Dial turns smaller than this (radians, ~1.5°) are hand shake and do not start a fade. */
const TURN_THRESHOLD = (1.5 * Math.PI) / 180;

/**
 * With no rotation, looking down −Z shows the centre of the equirect (u = 0.5), and a
 * rotation of θ moves the forward view to u = 0.5 − θ/2π (calibrated with a labelled
 * test panorama). Rotate so the place's focal point (focusU) is straight ahead.
 */
export function yawForFocus(u: number): number {
  return Math.PI - 2 * Math.PI * u;
}

/**
 * Shows the selected place as a DomeTexture (background) + IBLTexture (lighting)
 * on the level root, fading through dark when the place changes.
 */
export class PlaceSystem extends createSystem({}) {
  private root!: Entity;
  /** 0..1 fade used for place transitions. */
  private fade = 0;
  private fadeTarget = 0;
  private fadeRate = 1 / FADE_IN;
  /** Session light level (dims at start, set by `light` cues). */
  private level = 1;
  private levelFrom = 1;
  private levelTo = 1;
  private levelT = 1;
  private levelDur = 0;
  private place: Place | null = null;
  private token = 0;
  private hdLoaded = new Set<string>();
  /**
   * Background textures this system has handed to the dome, by URL. Each holds a full GPU copy
   * (an 8k panorama is ~170 MiB, a 4k ~43 MiB) that three.js keeps until `dispose()`, so a
   * headset runs out of memory after a place change or two unless the old ones are released.
   */
  private bgTextures = new Map<string, Texture>();
  /** A background was swapped: release the old ones once the dome no longer shows them. */
  private releasePending = false;
  /** Yaw (radians) the user has asked for with the dial (the knob shows this). */
  private userYaw = 0;
  /** Part of `userYaw` actually applied to the panorama; it only catches up while dark. */
  private appliedYaw = 0;
  /** 0..1 fade for dial turns (1 = shown). */
  private turnK = 1;
  /** The dial was released with a turn waiting: fade out and apply it. */
  private turnPending = false;

  init(): void {
    const root = this.world.activeLevel.value;
    if (!root) throw new Error('PlaceSystem: no active level');
    this.root = root;
    this.show(store.get().prefs.place);
    this.cleanupFuncs.push(
      store.subscribe((s, prev) => {
        if (s.prefs.place !== prev.prefs.place) this.show(s.prefs.place);
        if (s.immersive && !prev.immersive) this.maybeUpgrade();
      }),
      this.world.visibilityState.subscribe((v) => {
        if (v !== VisibilityState.NonImmersive) this.maybeUpgrade();
      }),
    );
  }

  /** Animate the session light level (0 = dark, 1 = full). */
  setLevel(level: number, seconds: number) {
    this.levelFrom = this.level;
    this.levelTo = level;
    this.levelDur = Math.max(0, seconds);
    this.levelT = 0;
    if (this.levelDur === 0) this.level = level;
  }

  private async show(id: string) {
    const place = PLACES.find((p) => p.id === id) ?? PLACES[0];
    const token = ++this.token;
    store.set({ loading: true });
    this.fadeTarget = 0;
    this.fadeRate = 1 / FADE_OUT;

    const bgUrl = publicUrl(`hdri/${place.id}_4k.jpg`);
    const iblUrl = publicUrl(`hdri/${place.id}_ibl.hdr`);
    let bg: Texture;
    try {
      [bg] = await Promise.all([
        AssetManager.loadTexture(bgUrl),
        AssetManager.loadHDRTexture(iblUrl),
        // Let the fade-out finish so the swap happens in the dark.
        new Promise((r) => setTimeout(r, this.place ? FADE_OUT * 1000 : 0)),
      ]);
    } catch (e) {
      console.error(`[place] failed to load ${place.id}`, e);
      if (token === this.token) store.set({ loading: false });
      return;
    }
    if (token !== this.token) return;
    bg.colorSpace = SRGBColorSpace;
    this.trackBackground(bgUrl, bg);

    this.place = place;
    // A newly shown place always faces its focal point.
    this.userYaw = 0;
    this.appliedYaw = 0;
    this.turnK = 1;
    this.turnPending = false;
    this.applySources(bgUrl, iblUrl, place);
    this.fadeTarget = 1;
    this.fadeRate = 1 / FADE_IN;
    store.set({ loading: false, shownPlace: place.id });
    this.maybeUpgrade();
  }

  /** Dev-only: extra yaw (degrees) for calibrating focusU with the [ and ] keys. */
  private devYaw = 0;

  private baseYaw(place: Place): number {
    return yawForFocus(place.focusU) + (this.devYaw * Math.PI) / 180 + this.appliedYaw;
  }

  /** How far (radians) the user has turned the surroundings with the dial. */
  get userTurn(): number {
    return this.userYaw;
  }

  /** Turn the surroundings by `angle` radians on the user's request (the dial). Applied on release. */
  turn(angle: number) {
    if (angle === 0) return;
    this.userYaw += angle;
  }

  /** The dial was let go: fade out, apply the new yaw while dark, fade back in. */
  endTurn() {
    if (Math.abs(this.userYaw - this.appliedYaw) > TURN_THRESHOLD) this.turnPending = true;
  }

  private pvYaw = 0;
  private pvBg = 0;
  private pvEnv = 0;

  /**
   * Make the scene look as it will once the current dial turn is applied (for the dial's
   * preview screen): the panorama turned by the pending yaw, at full turn brightness.
   * Must be paired with `previewEnd()` right after rendering.
   */
  previewBegin() {
    const place = this.place;
    this.pvYaw = this.userYaw - this.appliedYaw;
    this.pvBg = this.scene.backgroundIntensity;
    this.pvEnv = this.scene.environmentIntensity;
    this.scene.backgroundRotation.y += this.pvYaw;
    this.scene.environmentRotation.y += this.pvYaw;
    if (place) {
      const k = this.fade * this.level;
      this.scene.backgroundIntensity = place.domeIntensity * k;
      this.scene.environmentIntensity = place.iblIntensity * (0.15 + 0.85 * k);
    }
  }

  previewEnd() {
    this.scene.backgroundRotation.y -= this.pvYaw;
    this.scene.environmentRotation.y -= this.pvYaw;
    this.scene.backgroundIntensity = this.pvBg;
    this.scene.environmentIntensity = this.pvEnv;
  }

  /** Runs the release fade. Returns true if turnK changed. */
  private stepTurn(delta: number): boolean {
    if (this.turnPending) {
      this.turnK = Math.max(0, this.turnK - delta / TURN_FADE_OUT);
      if (this.turnK === 0) {
        this.turnPending = false;
        const pending = this.userYaw - this.appliedYaw;
        this.appliedYaw = this.userYaw;
        this.applyYawDelta(pending);
      }
      return true;
    }
    if (this.turnK < 1) {
      this.turnK = Math.min(1, this.turnK + delta / TURN_FADE_IN);
      return true;
    }
    return false;
  }

  /**
   * Turn the dome and its lighting together. The component holds the authored yaw and the
   * scene rotations also carry the engine's recenter offset, so both are nudged by the
   * same amount rather than rewritten.
   */
  private applyYawDelta(angle: number) {
    const place = this.place;
    if (!place || !this.root.hasComponent(DomeTexture)) return;
    const yaw = this.baseYaw(place);
    this.root.getVectorView(DomeTexture, 'rotation')[1] = yaw;
    this.root.getVectorView(IBLTexture, 'rotation')[1] = yaw;
    this.scene.backgroundRotation.y += angle;
    this.scene.environmentRotation.y += angle;
  }

  private applySources(bgUrl: string, iblUrl: string, place: Place) {
    const yaw = this.baseYaw(place);
    const r = this.root;
    if (!r.hasComponent(DomeTexture)) {
      r.addComponent(DomeTexture, { src: bgUrl, intensity: 0, blurriness: 0 });
    } else {
      r.setValue(DomeTexture, 'src', bgUrl);
    }
    if (!r.hasComponent(IBLTexture)) {
      r.addComponent(IBLTexture, { src: iblUrl, intensity: 0 });
    } else {
      r.setValue(IBLTexture, 'src', iblUrl);
    }
    r.getVectorView(DomeTexture, 'rotation').set([0, yaw, 0]);
    r.getVectorView(IBLTexture, 'rotation').set([0, yaw, 0]);
    this.writeIntensity(true);
  }

  /** In the headset, swap in the 8k background once it has downloaded. */
  private async maybeUpgrade() {
    const s = store.get();
    const place = this.place;
    if (!place || !s.prefs.hd || this.world.visibilityState.value === VisibilityState.NonImmersive) return;
    const url = publicUrl(`hdri/${place.id}_8k.jpg`);
    if (this.hdLoaded.has(url)) return;
    this.hdLoaded.add(url);
    const token = this.token;
    try {
      const tex = await AssetManager.loadTexture(url);
      tex.colorSpace = SRGBColorSpace;
      if (token !== this.token || this.place !== place) {
        // Never shown, so never uploaded; let a later visit upgrade again.
        this.hdLoaded.delete(url);
        return;
      }
      this.trackBackground(url, tex);
      this.root.setValue(DomeTexture, 'src', url);
      this.root.setValue(DomeTexture, '_needsUpdate', true);
    } catch (e) {
      console.warn('[place] HD background unavailable', e);
    }
  }

  private trackBackground(url: string, tex: Texture) {
    this.bgTextures.set(url, tex);
    this.releasePending = true;
  }

  /**
   * Free the GPU copy of every background that is neither on screen nor about to be. The
   * EnvironmentSystem swaps `scene.background` a frame or more after `src` changes, and a
   * texture drawn again after `dispose()` is silently re-uploaded, so wait for the swap.
   * The decoded image stays in the AssetManager cache: revisiting a place re-uploads it
   * without downloading it again.
   */
  private releaseOldBackgrounds() {
    const shown = this.scene.background;
    const src = this.root.hasComponent(DomeTexture) ? this.root.getValue(DomeTexture, 'src') : '';
    let waiting = false;
    for (const [url, tex] of this.bgTextures) {
      if (url === src) {
        if (tex !== shown) waiting = true;
        continue;
      }
      if (tex === shown) {
        waiting = true;
        continue;
      }
      tex.dispose();
      this.bgTextures.delete(url);
      // Upgrade again when the place is revisited (the 8k is gone from the GPU).
      this.hdLoaded.delete(url);
    }
    this.releasePending = waiting;
  }

  private writeIntensity(needsUpdate: boolean) {
    const place = this.place;
    if (!place || !this.root.hasComponent(DomeTexture)) return;
    const t = this.turnK;
    const k = this.fade * this.level * t * t * (3 - 2 * t);
    const dome = place.domeIntensity * k;
    // IBL never drops fully to black so the orb and mat stay faintly lit.
    const ibl = place.iblIntensity * (0.15 + 0.85 * k);
    this.root.setValue(DomeTexture, 'intensity', dome);
    this.root.setValue(IBLTexture, 'intensity', ibl);
    if (needsUpdate) {
      this.root.setValue(DomeTexture, '_needsUpdate', true);
      this.root.setValue(IBLTexture, '_needsUpdate', true);
    }
    // EnvironmentSystem only copies props on _needsUpdate; write the live values directly for smooth fades.
    this.scene.backgroundIntensity = dome;
    this.scene.environmentIntensity = ibl;
  }

  update(delta: number): void {
    if (import.meta.env.DEV && this.place) {
      const kb = this.world.input.keyboard;
      const step = kb?.getKeyDown('BracketRight') ? 30 : kb?.getKeyDown('BracketLeft') ? -30 : 0;
      if (step) {
        this.devYaw += step;
        const yaw = this.baseYaw(this.place);
        this.root.getVectorView(DomeTexture, 'rotation').set([0, yaw, 0]);
        this.root.getVectorView(IBLTexture, 'rotation').set([0, yaw, 0]);
        this.root.setValue(DomeTexture, '_needsUpdate', true);
        this.root.setValue(IBLTexture, '_needsUpdate', true);
        console.info(`[place] devYaw=${this.devYaw}° total=${((yaw * 180) / Math.PI).toFixed(1)}°`);
      }
    }
    if (this.releasePending) this.releaseOldBackgrounds();
    let changed = this.stepTurn(delta);
    if (this.fade !== this.fadeTarget) {
      const step = delta * this.fadeRate;
      this.fade =
        this.fade < this.fadeTarget
          ? Math.min(this.fadeTarget, this.fade + step)
          : Math.max(this.fadeTarget, this.fade - step);
      changed = true;
    }
    if (this.levelT < 1) {
      this.levelT = this.levelDur > 0 ? Math.min(1, this.levelT + delta / this.levelDur) : 1;
      const e = this.levelT * this.levelT * (3 - 2 * this.levelT);
      this.level = this.levelFrom + (this.levelTo - this.levelFrom) * e;
      changed = true;
    }
    if (changed) this.writeIntensity(false);
  }
}
