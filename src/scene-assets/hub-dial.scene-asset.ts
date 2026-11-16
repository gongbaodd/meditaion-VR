import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
} from '@iwsdk/core';

const D2R = Math.PI / 180;

// Unlit: the hub is nearly dark, so lit materials would vanish.
const metal = new MeshBasicMaterial({ color: 0x555a66 });
const knobMat = new MeshBasicMaterial({ color: 0x8a90a0 });
const ridgeMat = new MeshBasicMaterial({ color: 0x3a3e48 });
const line = new MeshBasicMaterial({ color: 0xe8eaf0 });
const marker = new MeshBasicMaterial({ color: 0xf1d9a8 });

/**
 * Hub dial: a slim stand, 0.85 m high, topped by a face plate tilted 35 degrees toward +Z
 * (the viewer) with a 12 cm knob. Origin at the floor under the stand.
 * Parts: Stand, Head (tilted), Plate, Ticks (6), Knob (spin it around its local Y), Pointer.
 */
function build(): Group {
  const root = new Group();
  root.name = 'HubDial';

  const stand = new Mesh(new CylinderGeometry(0.012, 0.02, 0.81, 16), metal);
  stand.name = 'Stand';
  stand.position.y = 0.405;
  const foot = new Mesh(new CylinderGeometry(0.1, 0.12, 0.012, 32), metal);
  foot.name = 'Foot';
  foot.position.y = 0.006;
  root.add(stand, foot);

  const head = new Group();
  head.name = 'Head';
  head.position.y = 0.85;
  head.rotation.x = 35 * D2R;
  root.add(head);

  const plate = new Mesh(new CylinderGeometry(0.095, 0.1, 0.018, 48), metal);
  plate.name = 'Plate';
  head.add(plate);

  // Six detent ticks around the plate rim.
  const ticks = new Group();
  ticks.name = 'Ticks';
  const tickGeo = new BoxGeometry(0.006, 0.004, 0.018);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const t = new Mesh(tickGeo, line);
    t.name = `Tick${i}`;
    t.position.set(Math.sin(a) * 0.081, 0.011, Math.cos(a) * 0.081);
    t.rotation.y = a;
    ticks.add(t);
  }
  head.add(ticks);

  const knob = new Group();
  knob.name = 'Knob';
  knob.position.y = 0.024;
  const body = new Mesh(new CylinderGeometry(0.06, 0.064, 0.03, 48), knobMat);
  body.name = 'KnobBody';
  knob.add(body);
  // Grip ridges.
  const ridgeGeo = new BoxGeometry(0.006, 0.026, 0.01);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = new Mesh(ridgeGeo, ridgeMat);
    r.name = `Ridge${i}`;
    r.position.set(Math.sin(a) * 0.063, 0, Math.cos(a) * 0.063);
    r.rotation.y = a;
    knob.add(r);
  }
  const pointer = new Mesh(new BoxGeometry(0.008, 0.004, 0.04), marker);
  pointer.name = 'Pointer';
  pointer.position.set(0, 0.017, 0.032);
  knob.add(pointer);
  head.add(knob);

  return root;
}

export default build();
