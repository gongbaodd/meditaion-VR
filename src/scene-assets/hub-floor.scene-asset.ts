import { DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry } from '@iwsdk/core';

/**
 * Concentric thin line rings on the floor, radius 1.5 .. 6 m, fading with distance.
 * Origin at the floor centre. Lies flat (y = 0).
 */
function build(): Group {
  const root = new Group();
  root.name = 'HubFloor';
  const radii = [1.5, 2, 2.5, 3, 3.5, 4, 4.7, 5.4, 6];
  radii.forEach((r, i) => {
    const k = 1 - i / radii.length;
    const m = new Mesh(
      new RingGeometry(r, r + 0.012 + r * 0.002, 160),
      new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.12 + 0.5 * k * k,
        side: DoubleSide,
        depthWrite: false,
      }),
    );
    m.name = `Ring${i}`;
    m.rotation.x = -Math.PI / 2;
    root.add(m);
  });
  return root;
}

export default build();
