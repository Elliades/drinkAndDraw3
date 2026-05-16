import { Vector3 } from "three";
import { VISIBILITY_THRESHOLD } from "../lib/draw-stick-figure";
import { estimateMeanLegLength } from "./mixamo-y-bot-retarget";

export interface RiggedRootScaleInput {
  points: Vector3[];
  visibility: number[];
  /** Bind-pose body height (world Y extent) from the loaded mesh. */
  modelBindHeight: number;
  /** Bind-pose Hips → LeftFoot distance from the loaded mesh. */
  modelBindLegLen: number;
}

/**
 * Same scalar applied to {@link RiggedCharacter} `root.scale` so the mesh matches
 * MediaPipe limb lengths — reuse for stick gizmo thickness so it tracks the figure.
 */
export function computeRigRootScale(input: RiggedRootScaleInput): number {
  const { points, visibility, modelBindHeight, modelBindLegLen } = input;

  let mpHeight = 1.65;
  const nose = points[0];
  const la = points[27];
  const ra = points[28];
  if (nose && (visibility[0] ?? 1) >= VISIBILITY_THRESHOLD) {
    const ankle =
      (visibility[27] ?? 1) >= VISIBILITY_THRESHOLD
        ? la
        : (visibility[28] ?? 1) >= VISIBILITY_THRESHOLD
          ? ra
          : null;
    if (ankle) mpHeight = Math.max(0.4, Math.abs(nose.y - ankle.y));
  }

  const mh = modelBindHeight > 1e-3 ? modelBindHeight : 1.8;
  const heightScale = (mpHeight / mh) * 0.92;

  const mpLeg = estimateMeanLegLength(points, visibility);
  let scale = heightScale;
  const ml = modelBindLegLen > 1e-3 ? modelBindLegLen : 0.95;
  if (mpLeg != null && ml > 1e-3) {
    const legScale = (mpLeg / ml) * 0.96;
    scale = heightScale * 0.45 + legScale * 0.55;
  }
  return scale;
}
