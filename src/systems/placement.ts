import { type Object3D, Quaternion, Vector3, VisibilityState, type World } from '@iwsdk/core';

const pos = new Vector3();
const dir = new Vector3();
const up = new Vector3(0, 1, 0);
const q = new Quaternion();

/** World-space position and horizontal facing (yaw) of the viewer. */
export function viewerPose(world: World): { position: Vector3; yaw: number } {
  const head: Object3D =
    world.visibilityState.value === VisibilityState.NonImmersive ? world.camera : world.player.head;
  head.updateWorldMatrix(true, false);
  head.getWorldPosition(pos);
  head.getWorldDirection(dir); // for cameras this is the view direction (−Z)
  // Object3D.getWorldDirection returns +Z for non-cameras; the head group looks down −Z.
  if (!(head as { isCamera?: boolean }).isCamera) dir.negate();
  const yaw = Math.atan2(-dir.x, -dir.z);
  return { position: pos.clone(), yaw };
}

/**
 * Place `obj` in front of the viewer: `distance` metres ahead on the horizontal plane,
 * `dy` metres relative to eye height, facing back at the viewer, tilted by `pitchDeg`.
 */
export function placeInFront(
  world: World,
  obj: Object3D,
  distance: number,
  dy: number,
  pitchDeg = 0,
  yawOffsetDeg = 0,
) {
  const { position, yaw: viewYaw } = viewerPose(world);
  const yaw = viewYaw + (yawOffsetDeg * Math.PI) / 180;
  obj.position.set(
    position.x - Math.sin(yaw) * distance,
    Math.max(0.3, position.y + dy),
    position.z - Math.cos(yaw) * distance,
  );
  // Panels face +Z, so yawing by the view yaw turns them toward the viewer.
  obj.quaternion.setFromAxisAngle(up, yaw);
  q.setFromAxisAngle(new Vector3(1, 0, 0), (pitchDeg * Math.PI) / 180);
  obj.quaternion.multiply(q);
}
