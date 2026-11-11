import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { store } from './app.js';
import { BreathOrbSystem } from './systems/breath-orb-system.js';
import { GroundSystem } from './systems/ground-system.js';
import { LookSystem } from './systems/look-system.js';
import { PlaceSystem } from './systems/place-system.js';
import { SessionSystem } from './systems/session-system.js';
import { VRUISystem } from './systems/vr-ui-system.js';
import { mountOverlay } from './ui/overlay.js';
import { SessionSystemRef } from './ui/session-ref.js';

mountOverlay();

navigator.xr
  ?.isSessionSupported('immersive-vr')
  .then((ok) => store.set({ xrSupported: ok }))
  .catch(() => store.set({ xrSupported: false }));

World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions).then((world) => {
  world.registerSystem(PlaceSystem);
  world.registerSystem(GroundSystem);
  world.registerSystem(BreathOrbSystem);
  world.registerSystem(SessionSystem);
  world.registerSystem(VRUISystem);
  world.registerSystem(LookSystem);

  SessionSystemRef.lastSat = () => world.getSystem(SessionSystem)?.lastSat ?? null;
  // Handy for debugging in the console.
  Object.assign(window, { world, store });
});
