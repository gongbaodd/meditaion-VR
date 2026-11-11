import {
  CanvasTexture,
  CircleGeometry,
  createSystem,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Vector2,
} from '@iwsdk/core';

/** Radial alpha mask so the mat's edge melts into the HDRI ground. */
function softEdge(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, '#fff');
  grd.addColorStop(0.7, '#fff');
  grd.addColorStop(1, '#000');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new CanvasTexture(c);
}

/**
 * A real object under the viewer: a round mat and a meditation cushion.
 * An HDRI has no parallax and its nadir is often a blurred tripod patch; a solid,
 * IBL-lit object at your feet grounds you and hides it.
 */
export class GroundSystem extends createSystem({}) {
  init(): void {
    const group = new Group();

    const mat = new Mesh(
      new CircleGeometry(0.9, 64),
      new MeshStandardMaterial({
        color: 0x5a4a3c,
        roughness: 1,
        transparent: true,
        alphaMap: softEdge(),
        depthWrite: false,
      }),
    );
    mat.rotation.x = -Math.PI / 2;
    mat.position.y = 0.003;

    // Zafu: a rounded cushion profile spun around Y.
    const pts: Vector2[] = [];
    const r = 0.19;
    const h = 0.13;
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      pts.push(new Vector2(r + Math.sin(a) * 0.035, h / 2 - Math.cos(a) * (h / 2)));
    }
    pts.unshift(new Vector2(0, 0));
    pts.push(new Vector2(0, h));
    const cushion = new Mesh(
      new LatheGeometry(pts, 48),
      new MeshStandardMaterial({ color: 0x2f3a4a, roughness: 0.95 }),
    );
    cushion.position.set(0, 0.005, 0.05);

    group.add(mat, cushion);
    this.world.createTransformEntity(group);
  }
}
