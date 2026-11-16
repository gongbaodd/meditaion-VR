import { createSystem, Euler, VisibilityState } from '@iwsdk/core';
import { store } from '../app.js';

const EYE_HEIGHT = 1.2; // seated

/**
 * On a flat screen there is no head tracking: drag (mouse/touch) or use the
 * arrow keys to look around. The camera never moves, it only turns.
 */
export class LookSystem extends createSystem({}) {
  private yaw = 0;
  private pitch = -0.2; // starts in the hub
  private targetYaw = 0;
  private targetPitch = -0.2;
  private dragging: { id: number; x: number; y: number } | null = null;
  private euler = new Euler(0, 0, 0, 'YXZ');
  private idle = 0;

  init(): void {
    const canvas = this.world.renderer.domElement;
    canvas.style.touchAction = 'none';
    const down = (e: PointerEvent) => {
      if (this.world.visibilityState.value !== VisibilityState.NonImmersive) return;
      if (store.get().mode === 'hub') return; // the hub is not for looking around
      this.dragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const move = (e: PointerEvent) => {
      const d = this.dragging;
      if (!d || d.id !== e.pointerId) return;
      const k = (Math.PI / canvas.clientHeight) * 0.9;
      this.targetYaw += (e.clientX - d.x) * k;
      this.targetPitch = Math.max(-1.2, Math.min(1.2, this.targetPitch + (e.clientY - d.y) * k));
      d.x = e.clientX;
      d.y = e.clientY;
      this.idle = 0;
    };
    const up = (e: PointerEvent) => {
      if (this.dragging?.id !== e.pointerId) return;
      this.dragging = null;
      canvas.style.cursor = 'grab';
    };
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    this.cleanupFuncs.push(() => {
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    });
    // New place: face its view again.
    this.cleanupFuncs.push(
      store.subscribe((s, prev) => {
        if (s.prefs.place !== prev.prefs.place || (s.mode === 'hub' && prev.mode !== 'hub')) {
          // The hub is seen from slightly above so the dial at your feet fits in frame.
          this.targetPitch = s.mode === 'hub' ? -0.2 : 0;
          this.targetYaw = Math.round(this.targetYaw / (2 * Math.PI)) * 2 * Math.PI;
        }
      }),
    );
  }

  update(delta: number): void {
    if (this.world.visibilityState.value !== VisibilityState.NonImmersive) return;
    const hub = store.get().mode === 'hub';
    const kb = hub ? null : this.world.input.keyboard;
    const speed = 1.2 * delta;
    if (kb) {
      const held = (c: string) => kb.getKeyPressed(c);
      if (held('ArrowLeft')) this.targetYaw += speed;
      if (held('ArrowRight')) this.targetYaw -= speed;
      if (held('ArrowUp')) this.targetPitch = Math.min(1.2, this.targetPitch + speed);
      if (held('ArrowDown')) this.targetPitch = Math.max(-1.2, this.targetPitch - speed);
    }
    // While nobody touches it during a session, drift very slowly back to level.
    this.idle += delta;
    if (!this.dragging && this.idle > 8 && store.get().mode === 'running') {
      this.targetPitch *= 1 - Math.min(1, delta * 0.3);
    }
    const s = Math.min(1, delta * 10);
    this.yaw += (this.targetYaw - this.yaw) * s;
    this.pitch += (this.targetPitch - this.pitch) * s;
    const cam = this.world.camera;
    cam.position.set(0, EYE_HEIGHT, 0);
    this.euler.set(this.pitch, this.yaw, 0);
    cam.quaternion.setFromEuler(this.euler);
  }
}
