import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
} from '@iwsdk/core';

const D2R = Math.PI / 180;

/** Place colours, in places.json order. Duplicated here: assets must not import app data. */
const PLACE_COLORS = [0xff9d6c, 0x7fd08a, 0x6fc3d9, 0xffc46b, 0xb9e36b, 0x7d8cff];

// Unlit: the hub is nearly dark, so lit materials would vanish.
const metal = new MeshBasicMaterial({ color: 0x555a66 });
const plateMat = new MeshBasicMaterial({ color: 0x23262d });
const trackMat = new MeshBasicMaterial({ color: 0x0b0c0f });
const capMat = new MeshBasicMaterial({ color: 0x3a3e48 });
const armMat = new MeshBasicMaterial({ color: 0x8a90a0 });
const handleMat = new MeshBasicMaterial({ color: 0x8a90a0 });
const haloMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });

/** Radius of the circle the handle rides on, metres. */
export const HANDLE_R = 0.082;

/**
 * Hub dial: a slim stand, 0.85 m high, topped by a 20 cm plate tilted 35 degrees toward +Z
 * (the viewer). A fixed ring of six coloured marks sits on the plate; a turning part (Knob: cap,
 * arm and a 3.5 cm Handle on the rim) spins around its local Y. Detent i is at the Knob angle
 * `PI - i * 60deg` (detent 0 at the far edge of the plate). Origin at the floor under the stand.
 * Parts: Stand, Foot, Head (tilted), Plate, Track, Marks (6), Knob (Cap, Arm, Handle, HandleHalo).
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

  const plate = new Mesh(new CylinderGeometry(0.1, 0.104, 0.018, 64), plateMat);
  plate.name = 'Plate';
  head.add(plate);

  // Dark groove the handle rides in.
  const track = new Mesh(new RingGeometry(HANDLE_R - 0.012, HANDLE_R + 0.012, 64), trackMat);
  track.name = 'Track';
  track.rotation.x = -Math.PI / 2;
  track.position.y = 0.0095;
  head.add(track);

  // Six detent marks in the place colours, just inside the rim.
  const marks = new Group();
  marks.name = 'Marks';
  const markGeo = new BoxGeometry(0.006, 0.004, 0.016);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI - i * 60 * D2R;
    const m = new Mesh(markGeo, new MeshBasicMaterial({ color: PLACE_COLORS[i] }));
    m.name = `Mark${i}`;
    m.position.set(Math.sin(a) * 0.097, 0.011, Math.cos(a) * 0.097);
    m.rotation.y = a;
    marks.add(m);
  }
  head.add(marks);

  // Turning part. At rotation.y = 0 the handle points along +Z.
  const knob = new Group();
  knob.name = 'Knob';
  knob.position.y = 0.01;
  const cap = new Mesh(new CylinderGeometry(0.03, 0.032, 0.014, 40), capMat);
  cap.name = 'Cap';
  cap.position.y = 0.007;
  const arm = new Mesh(new BoxGeometry(0.01, 0.006, HANDLE_R), armMat);
  arm.name = 'Arm';
  arm.position.set(0, 0.012, HANDLE_R / 2);
  const handle = new Mesh(new SphereGeometry(0.0175, 24, 16), handleMat);
  handle.name = 'Handle';
  handle.position.set(0, 0.03, HANDLE_R);
  const halo = new Mesh(new SphereGeometry(0.034, 20, 12), haloMat);
  halo.name = 'HandleHalo';
  halo.position.copy(handle.position);
  halo.visible = false;
  knob.add(cap, arm, handle, halo);
  head.add(knob);

  return root;
}

export default build();
