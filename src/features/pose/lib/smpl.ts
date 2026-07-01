/**
 * Shared SMPL body-model core.
 *
 * SMPL describes the body with 24 joints in a fixed kinematic tree. The offline
 * NLF tool gives us, per reference image, a 72-dim axis-angle `pose` (24 joints
 * x 3, local rotations relative to the SMPL rest pose) plus 24 joint positions.
 *
 * This module turns that pose into **global joint quaternions** via forward
 * kinematics (the local rotations down the chain are what carry axial twist),
 * exposes the SMPL connection set used to draw the stick figure, and maps SMPL
 * joints to the Mixamo bone names used by the anatomical rig.
 */

import { Quaternion, Vector3 } from "three";
import type { Side } from "./topology";

// ---------------------------------------------------------------------------
// Joint indices, names, and parent tree (standard SMPL 24-joint ordering)
// ---------------------------------------------------------------------------

export const SMPL = {
  PELVIS: 0,
  LEFT_HIP: 1,
  RIGHT_HIP: 2,
  SPINE1: 3,
  LEFT_KNEE: 4,
  RIGHT_KNEE: 5,
  SPINE2: 6,
  LEFT_ANKLE: 7,
  RIGHT_ANKLE: 8,
  SPINE3: 9,
  LEFT_FOOT: 10,
  RIGHT_FOOT: 11,
  NECK: 12,
  LEFT_COLLAR: 13,
  RIGHT_COLLAR: 14,
  HEAD: 15,
  LEFT_SHOULDER: 16,
  RIGHT_SHOULDER: 17,
  LEFT_ELBOW: 18,
  RIGHT_ELBOW: 19,
  LEFT_WRIST: 20,
  RIGHT_WRIST: 21,
  LEFT_HAND: 22,
  RIGHT_HAND: 23,
} as const;

export const SMPL_JOINT_COUNT = 24;

export const SMPL_JOINT_NAMES: readonly string[] = [
  "pelvis",
  "left_hip",
  "right_hip",
  "spine1",
  "left_knee",
  "right_knee",
  "spine2",
  "left_ankle",
  "right_ankle",
  "spine3",
  "left_foot",
  "right_foot",
  "neck",
  "left_collar",
  "right_collar",
  "head",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hand",
  "right_hand",
];

/** Parent joint index for each SMPL joint; the pelvis (root) is -1. */
export const SMPL_PARENTS: readonly number[] = [
  -1, // pelvis
  0, // left_hip
  0, // right_hip
  0, // spine1
  1, // left_knee
  2, // right_knee
  3, // spine2
  4, // left_ankle
  5, // right_ankle
  6, // spine3
  7, // left_foot
  8, // right_foot
  9, // neck
  9, // left_collar
  9, // right_collar
  12, // head
  13, // left_shoulder
  14, // right_shoulder
  16, // left_elbow
  17, // right_elbow
  18, // left_wrist
  19, // right_wrist
  20, // left_hand
  21, // right_hand
];

// ---------------------------------------------------------------------------
// Stick-figure connections + side coloring
// ---------------------------------------------------------------------------

/** Bones drawn for the SMPL stick figure (pairs of joint indices). */
export const SMPL_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  // Spine chain
  [SMPL.PELVIS, SMPL.SPINE1],
  [SMPL.SPINE1, SMPL.SPINE2],
  [SMPL.SPINE2, SMPL.SPINE3],
  [SMPL.SPINE3, SMPL.NECK],
  [SMPL.NECK, SMPL.HEAD],
  // Collars / shoulders
  [SMPL.SPINE3, SMPL.LEFT_COLLAR],
  [SMPL.SPINE3, SMPL.RIGHT_COLLAR],
  [SMPL.LEFT_COLLAR, SMPL.LEFT_SHOULDER],
  [SMPL.RIGHT_COLLAR, SMPL.RIGHT_SHOULDER],
  // Arms
  [SMPL.LEFT_SHOULDER, SMPL.LEFT_ELBOW],
  [SMPL.LEFT_ELBOW, SMPL.LEFT_WRIST],
  [SMPL.LEFT_WRIST, SMPL.LEFT_HAND],
  [SMPL.RIGHT_SHOULDER, SMPL.RIGHT_ELBOW],
  [SMPL.RIGHT_ELBOW, SMPL.RIGHT_WRIST],
  [SMPL.RIGHT_WRIST, SMPL.RIGHT_HAND],
  // Legs
  [SMPL.PELVIS, SMPL.LEFT_HIP],
  [SMPL.PELVIS, SMPL.RIGHT_HIP],
  [SMPL.LEFT_HIP, SMPL.LEFT_KNEE],
  [SMPL.LEFT_KNEE, SMPL.LEFT_ANKLE],
  [SMPL.LEFT_ANKLE, SMPL.LEFT_FOOT],
  [SMPL.RIGHT_HIP, SMPL.RIGHT_KNEE],
  [SMPL.RIGHT_KNEE, SMPL.RIGHT_ANKLE],
  [SMPL.RIGHT_ANKLE, SMPL.RIGHT_FOOT],
];

const LEFT_JOINTS = new Set<number>([
  SMPL.LEFT_HIP,
  SMPL.LEFT_KNEE,
  SMPL.LEFT_ANKLE,
  SMPL.LEFT_FOOT,
  SMPL.LEFT_COLLAR,
  SMPL.LEFT_SHOULDER,
  SMPL.LEFT_ELBOW,
  SMPL.LEFT_WRIST,
  SMPL.LEFT_HAND,
]);
const RIGHT_JOINTS = new Set<number>([
  SMPL.RIGHT_HIP,
  SMPL.RIGHT_KNEE,
  SMPL.RIGHT_ANKLE,
  SMPL.RIGHT_FOOT,
  SMPL.RIGHT_COLLAR,
  SMPL.RIGHT_SHOULDER,
  SMPL.RIGHT_ELBOW,
  SMPL.RIGHT_WRIST,
  SMPL.RIGHT_HAND,
]);

export function smplJointSide(index: number): Side {
  if (LEFT_JOINTS.has(index)) return "left";
  if (RIGHT_JOINTS.has(index)) return "right";
  return "center";
}

export function smplConnectionSide(a: number, b: number): Side {
  const sa = smplJointSide(a);
  const sb = smplJointSide(b);
  if (sa === sb) return sa;
  if (sa === "center") return sb;
  if (sb === "center") return sa;
  return "center";
}

// ---------------------------------------------------------------------------
// SMPL -> Mixamo bone mapping (anatomical rig)
// ---------------------------------------------------------------------------

/**
 * SMPL joint index -> Mixamo bone "core" name (the value passed to
 * {@link resolveMixamoBone}). Chosen so each mapped SMPL joint's parent maps to
 * the Mixamo bone's actual parent, which lets us convert global rotations to
 * bone-local rotations purely through the SMPL parent tree.
 */
export const SMPL_TO_MIXAMO: ReadonlyArray<readonly [number, string]> = [
  [SMPL.PELVIS, "Hips"],
  [SMPL.SPINE1, "Spine"],
  [SMPL.SPINE2, "Spine1"],
  [SMPL.SPINE3, "Spine2"],
  [SMPL.NECK, "Neck"],
  [SMPL.HEAD, "Head"],
  [SMPL.LEFT_COLLAR, "LeftShoulder"],
  [SMPL.RIGHT_COLLAR, "RightShoulder"],
  [SMPL.LEFT_SHOULDER, "LeftArm"],
  [SMPL.RIGHT_SHOULDER, "RightArm"],
  [SMPL.LEFT_ELBOW, "LeftForeArm"],
  [SMPL.RIGHT_ELBOW, "RightForeArm"],
  [SMPL.LEFT_WRIST, "LeftHand"],
  [SMPL.RIGHT_WRIST, "RightHand"],
  [SMPL.LEFT_HIP, "LeftUpLeg"],
  [SMPL.RIGHT_HIP, "RightUpLeg"],
  [SMPL.LEFT_KNEE, "LeftLeg"],
  [SMPL.RIGHT_KNEE, "RightLeg"],
  [SMPL.LEFT_ANKLE, "LeftFoot"],
  [SMPL.RIGHT_ANKLE, "RightFoot"],
  [SMPL.LEFT_FOOT, "LeftToeBase"],
  [SMPL.RIGHT_FOOT, "RightToeBase"],
];

// ---------------------------------------------------------------------------
// Forward kinematics
// ---------------------------------------------------------------------------

const _axis = new Vector3();

/** Local axis-angle (3 numbers at offset 3*j) -> quaternion. */
export function axisAngleToQuaternion(
  pose: ArrayLike<number>,
  j: number,
  out: Quaternion,
): Quaternion {
  const x = pose[3 * j] ?? 0;
  const y = pose[3 * j + 1] ?? 0;
  const z = pose[3 * j + 2] ?? 0;
  const angle = Math.hypot(x, y, z);
  if (angle < 1e-8) {
    out.set(0, 0, 0, 1);
    return out;
  }
  _axis.set(x / angle, y / angle, z / angle);
  out.setFromAxisAngle(_axis, angle);
  return out;
}

/**
 * Accumulate SMPL local rotations down the parent tree into **global** joint
 * quaternions (in the SMPL/camera frame). `global[j] = global[parent] * local[j]`.
 * The accumulated rotations carry axial twist, unlike direction-only fits.
 */
export function forwardKinematics(pose: ArrayLike<number>): Quaternion[] {
  const local: Quaternion[] = new Array(SMPL_JOINT_COUNT);
  const global: Quaternion[] = new Array(SMPL_JOINT_COUNT);
  for (let j = 0; j < SMPL_JOINT_COUNT; j++) {
    local[j] = axisAngleToQuaternion(pose, j, new Quaternion());
    global[j] = new Quaternion();
  }
  for (let j = 0; j < SMPL_JOINT_COUNT; j++) {
    const p = SMPL_PARENTS[j]!;
    if (p < 0) {
      global[j]!.copy(local[j]!);
    } else {
      global[j]!.copy(global[p]!).multiply(local[j]!);
    }
  }
  return global;
}

const _STICK_AXIS_X = new Vector3(1, 0, 0);
const _STICK_UP_Y = new Vector3(0, 1, 0);
const _stickRefX = new Vector3();
const _stickJointX = new Vector3();
const _stickProj = new Vector3();
const _stickCross = new Vector3();
const _stickQDir = new Quaternion();

/**
 * Axial roll (radians) about a stick segment that matches {@link SmplStick3D}
 * ribbon orientation — used to correct forearms / shins after direction aim.
 */
export function smplStickSegmentRoll(
  proximalGlobalInThree: Quaternion,
  segmentDirUnit: Vector3,
): number {
  if (segmentDirUnit.lengthSq() < 1e-10) return 0;
  _stickQDir.setFromUnitVectors(_STICK_UP_Y, segmentDirUnit);
  _stickRefX.copy(_STICK_AXIS_X).applyQuaternion(_stickQDir);
  _stickJointX.copy(_STICK_AXIS_X).applyQuaternion(proximalGlobalInThree);
  const dot = _stickJointX.dot(segmentDirUnit);
  _stickProj.copy(_stickJointX).addScaledVector(segmentDirUnit, -dot);
  if (_stickProj.lengthSq() < 1e-8) return 0;
  _stickProj.normalize();
  _stickCross.crossVectors(_stickRefX, _stickProj);
  const sin = segmentDirUnit.dot(_stickCross);
  const cos = _stickRefX.dot(_stickProj);
  return Math.atan2(sin, cos);
}

// ---------------------------------------------------------------------------
// Frame conversion: SMPL/NLF camera frame (Y-down, Z-forward) -> Three.js (Y-up)
// ---------------------------------------------------------------------------

/**
 * Constant rotation mapping the backend's camera frame to Three.js world: a
 * 180° turn about X, i.e. (x, y, z) -> (x, -y, -z). Used both for joint
 * positions and to bring SMPL global rotations into the Three.js frame.
 */
export const SMPL_TO_THREE_QUAT = new Quaternion().setFromAxisAngle(
  new Vector3(1, 0, 0),
  Math.PI,
);

const _smplThreeRInv = SMPL_TO_THREE_QUAT.clone().invert();

/** SMPL FK globals in the Three.js frame (same conjugation as the anatomical rig). */
export function smplGlobalQuatsInThree(pose: ArrayLike<number>): Quaternion[] {
  return forwardKinematics(pose).map((g) =>
    SMPL_TO_THREE_QUAT.clone().multiply(g).multiply(_smplThreeRInv),
  );
}

/** Largest axis span of a pelvis-centered joint cloud (after {@link smplJoints3dToThree}). */
export function smplJointsExtent(pts: Vector3[]): number {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const p of pts) {
    min.min(p);
    max.max(p);
  }
  return Math.max(max.x - min.x, max.y - min.y, max.z - min.z);
}

/** Scale the rig root so bind height matches the normalized SMPL stick (≈ HMR mesh height). */
export function computeSmplRigRootScale(
  pts: Vector3[],
  modelBindHeight: number,
): number {
  const extent = smplJointsExtent(pts);
  if (extent < 1e-6 || modelBindHeight < 1e-6) return 1;
  return modelBindHeight / extent;
}

/** Flip a SMPL/NLF point (Y-down, Z-forward) into Three.js (Y-up). */
export function smplPointToThree(p: ArrayLike<number>, out: Vector3): Vector3 {
  return out.set(p[0] ?? 0, -(p[1] ?? 0), -(p[2] ?? 0));
}

/** Target size (largest dimension) for the normalized joint cloud, in scene units. */
export const SMPL_VIEWER_TARGET_SIZE = 1.7;

/**
 * Convert the 24 joints3d to Three-frame Vector3s, centered on the pelvis and
 * scaled to a consistent size. The backend's joints3d may be in meters or
 * millimeters and carry an absolute camera translation; this normalization
 * makes the 3D stick figure units-agnostic and consistently framed.
 */
export function smplJoints3dToThree(joints3d: number[][]): Vector3[] {
  const pts = joints3d.map((p) => smplPointToThree(p, new Vector3()));
  const pelvis = pts[SMPL.PELVIS];
  if (pelvis) {
    const c = pelvis.clone();
    for (const p of pts) p.sub(c);
  }

  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const p of pts) {
    min.min(p);
    max.max(p);
  }
  const size = Math.max(max.x - min.x, max.y - min.y, max.z - min.z);
  if (Number.isFinite(size) && size > 1e-6) {
    const s = SMPL_VIEWER_TARGET_SIZE / size;
    for (const p of pts) p.multiplyScalar(s);
  }
  return pts;
}
