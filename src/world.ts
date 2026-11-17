import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { store } from './app.js';
import { BreathOrbSystem } from './systems/breath-orb-system.js';
import { GroundSystem } from './systems/ground-system.js';
import { LookSystem } from './systems/look-system.js';
import { PerfProbeSystem } from './systems/perf-probe-system.js';
import { PlaceSystem } from './systems/place-system.js';
import { SessionSystem } from './systems/session-system.js';
import { VRUISystem } from './systems/vr-ui-system.js';
import { SessionSystemRef } from './ui/session-ref.js';

/** Creates the IWSDK world. Loaded as its own chunk so the 2D menu can show first. */
export async function startWorld(perf: boolean) {
  const world = await World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions);
  world.registerSystem(PlaceSystem);
  world.registerSystem(GroundSystem);
  world.registerSystem(BreathOrbSystem);
  world.registerSystem(SessionSystem);
  world.registerSystem(VRUISystem);
  world.registerSystem(LookSystem);
  if (perf) world.registerSystem(PerfProbeSystem);

  SessionSystemRef.lastSat = () => world.getSystem(SessionSystem)?.lastSat ?? null;
  // Handy for debugging in the console.
  Object.assign(window, { world, store });
  return world;
}
