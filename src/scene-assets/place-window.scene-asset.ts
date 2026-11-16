import {
  AdditiveBlending,
  CircleGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Path,
  Shape,
  ShapeGeometry,
} from '@iwsdk/core';

/** Arch outline: straight sides up to (h - halfW), then a half circle on top. Origin at bottom centre. */
function arch(halfW: number, h: number, hole?: Path): Shape {
  const s = new Shape();
  const top = h - halfW;
  s.moveTo(-halfW, 0);
  s.lineTo(halfW, 0);
  s.lineTo(halfW, top);
  s.absarc(0, top, halfW, 0, Math.PI, false);
  s.lineTo(-halfW, 0);
  if (hole) s.holes.push(hole);
  return s;
}

function archPath(halfW: number, h: number, y0: number): Path {
  const p = new Path();
  const top = h - halfW;
  p.moveTo(-halfW, y0);
  p.lineTo(-halfW, top);
  p.absarc(0, top, halfW, Math.PI, 0, true);
  p.lineTo(halfW, y0);
  p.lineTo(-halfW, y0);
  return p;
}

const W = 0.45; // half width -> 0.9 m wide
const H = 1.7;
const LINE = 0.022;

const outlineMat = new MeshBasicMaterial({ color: 0xe8eaf0, side: DoubleSide });
const paneMat = new MeshBasicMaterial({ color: 0x0b0c10, side: DoubleSide });
const glowMat = new MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
  side: DoubleSide,
});

/**
 * One arched window for the hub, origin at the floor centre, face toward +Z, 0.9 x 1.7 m.
 * Named parts (HubSystem restyles them per instance by reassigning materials):
 *   Outline, Pane (shows the place), HaloA/B/C (additive glow layers), FloorGlow.
 */
function build(): Group {
  const root = new Group();
  root.name = 'PlaceWindow';

  const outline = new Mesh(new ShapeGeometry(arch(W, H, archPath(W - LINE, H - LINE, LINE)), 48), outlineMat);
  outline.name = 'Outline';
  outline.position.z = 0.004;

  const pane = new Mesh(new ShapeGeometry(arch(W - LINE, H - LINE), 48), paneMat);
  pane.name = 'Pane';
  pane.position.set(0, LINE, 0);

  root.add(pane, outline);

  // Soft glow: three nested arches, each slightly larger and behind the pane.
  const layers: [string, number, number][] = [
    ['HaloA', 0.06, -0.004],
    ['HaloB', 0.14, -0.008],
    ['HaloC', 0.28, -0.012],
  ];
  for (const [name, grow, z] of layers) {
    const m = new Mesh(new ShapeGeometry(arch(W + grow, H + grow * 1.2), 48), glowMat);
    m.name = name;
    m.position.set(0, -grow * 0.2, z);
    m.userData.iwsdkPreviewBounds = 'exclude';
    root.add(m);
  }

  const floor = new Mesh(new CircleGeometry(0.9, 48), glowMat);
  floor.name = 'FloorGlow';
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.003, 0.35);
  floor.scale.set(1, 0.7, 1);
  floor.userData.iwsdkPreviewBounds = 'exclude';
  root.add(floor);

  return root;
}

export default build();
