/**
 * Pose feature engineering — isomorphic (browser + Node).
 *
 * Feature vector layout (FEATURE_VECTOR_DIM = 86):
 *   [0..43]  — 22 joint angles as (sin θ, cos θ) pairs (ORDERED_ANGLE_KEYS)
 *   [44..85] — 21 landmarks × (x, y) normalized coords (LANDMARK_FEATURE_INDICES)
 */
import type { Landmark, Pose, WorldPose } from "./types";
import { LM, POSE_LANDMARK_COUNT } from "./topology";
import { normalizePose } from "./compare-pose";

export const FEATURE_VERSION = "1";
export const MEDIAPIPE_MODEL_VERSION = "pose_landmarker_lite/float16/1";

export const ORDERED_ANGLE_KEYS = [
  "leftElbowBend",
  "rightElbowBend",
  "leftKneeBend",
  "rightKneeBend",
  "leftShoulderRaise",
  "rightShoulderRaise",
  "leftHipFlex",
  "rightHipFlex",
  "leftWristBend",
  "rightWristBend",
  "leftAnkleBend",
  "rightAnkleBend",
  "neckTilt",
  "neckNod",
  "headTurn",
  "torsoLean",
  "torsoTilt",
  "torsoTwist",
  "leftLegRaise",
  "rightLegRaise",
  "leftArmSpread",
  "rightArmSpread",
] as const;

export type AngleKey = (typeof ORDERED_ANGLE_KEYS)[number];

export type JointAngles = Partial<Record<AngleKey, number>>;

export type LimbGroup =
  | "leftArm"
  | "rightArm"
  | "leftLeg"
  | "rightLeg"
  | "torso"
  | "head"
  | "archetype";

export type LimbStates = Partial<
  Record<LimbGroup, Partial<Record<string, string>>>
>;

export const POSE_VOCAB: Record<
  LimbGroup,
  Record<string, readonly string[]>
> = {
  leftArm: {
    raise: ["down", "mid", "raised", "overhead"],
    bend: ["straight", "bent", "folded"],
  },
  rightArm: {
    raise: ["down", "mid", "raised", "overhead"],
    bend: ["straight", "bent", "folded"],
  },
  leftLeg: {
    raise: ["down", "lifted", "high"],
    bend: ["straight", "bent", "folded"],
  },
  rightLeg: {
    raise: ["down", "lifted", "high"],
    bend: ["straight", "bent", "folded"],
  },
  torso: {
    lean: ["upright", "forward", "back"],
    tilt: ["level", "left", "right"],
    twist: ["straight", "twisted"],
  },
  head: {
    tilt: ["level", "left", "right"],
    nod: ["level", "down", "up"],
    turn: ["straight", "left", "right"],
  },
  archetype: {
    pose: ["standing", "sitting", "kneeling", "crouching", "lying", "jumping"],
  },
};

/** Landmarks included in the coordinate tail of the embedding. */
export const LANDMARK_FEATURE_INDICES: readonly number[] = [
  LM.NOSE,
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_ELBOW,
  LM.RIGHT_ELBOW,
  LM.LEFT_WRIST,
  LM.RIGHT_WRIST,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_KNEE,
  LM.RIGHT_KNEE,
  LM.LEFT_ANKLE,
  LM.RIGHT_ANKLE,
  LM.LEFT_HEEL,
  LM.RIGHT_HEEL,
  LM.LEFT_FOOT_INDEX,
  LM.RIGHT_FOOT_INDEX,
  LM.LEFT_EAR,
  LM.RIGHT_EAR,
  LM.MOUTH_LEFT,
  LM.MOUTH_RIGHT,
];

export const FEATURE_VECTOR_DIM =
  ORDERED_ANGLE_KEYS.length * 2 + LANDMARK_FEATURE_INDICES.length * 2;

const VISIBILITY_MIN = 0.3;

const ANGLE_TO_LIMB: Partial<Record<AngleKey, LimbGroup>> = {
  leftElbowBend: "leftArm",
  leftShoulderRaise: "leftArm",
  leftWristBend: "leftArm",
  leftArmSpread: "leftArm",
  rightElbowBend: "rightArm",
  rightShoulderRaise: "rightArm",
  rightWristBend: "rightArm",
  rightArmSpread: "rightArm",
  leftKneeBend: "leftLeg",
  leftHipFlex: "leftLeg",
  leftAnkleBend: "leftLeg",
  leftLegRaise: "leftLeg",
  rightKneeBend: "rightLeg",
  rightHipFlex: "rightLeg",
  rightAnkleBend: "rightLeg",
  rightLegRaise: "rightLeg",
  torsoLean: "torso",
  torsoTilt: "torso",
  torsoTwist: "torso",
  neckTilt: "head",
  neckNod: "head",
  headTurn: "head",
};

const LANDMARK_TO_LIMB: Record<number, LimbGroup> = {
  [LM.NOSE]: "head",
  [LM.LEFT_EAR]: "head",
  [LM.RIGHT_EAR]: "head",
  [LM.MOUTH_LEFT]: "head",
  [LM.MOUTH_RIGHT]: "head",
  [LM.LEFT_SHOULDER]: "leftArm",
  [LM.LEFT_ELBOW]: "leftArm",
  [LM.LEFT_WRIST]: "leftArm",
  [LM.RIGHT_SHOULDER]: "rightArm",
  [LM.RIGHT_ELBOW]: "rightArm",
  [LM.RIGHT_WRIST]: "rightArm",
  [LM.LEFT_HIP]: "leftLeg",
  [LM.LEFT_KNEE]: "leftLeg",
  [LM.LEFT_ANKLE]: "leftLeg",
  [LM.LEFT_HEEL]: "leftLeg",
  [LM.LEFT_FOOT_INDEX]: "leftLeg",
  [LM.RIGHT_HIP]: "rightLeg",
  [LM.RIGHT_KNEE]: "rightLeg",
  [LM.RIGHT_ANKLE]: "rightLeg",
  [LM.RIGHT_HEEL]: "rightLeg",
  [LM.RIGHT_FOOT_INDEX]: "rightLeg",
};

function isVisible(p: Landmark | undefined): p is Landmark {
  return !!p && (p.visibility ?? 1) >= VISIBILITY_MIN;
}

function jointAngleDeg(pose: Pose, joint: number, a: number, b: number): number | null {
  const j = pose[joint];
  const pa = pose[a];
  const pb = pose[b];
  if (!isVisible(j) || !isVisible(pa) || !isVisible(pb)) return null;
  const ax = pa.x - j.x;
  const ay = pa.y - j.y;
  const bx = pb.x - j.x;
  const by = pb.y - j.y;
  const la = Math.hypot(ax, ay);
  const lb = Math.hypot(bx, by);
  if (la < 1e-6 || lb < 1e-6) return null;
  let cos = (ax * bx + ay * by) / (la * lb);
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
}

function segmentAngleFromVerticalDeg(pose: Pose, from: number, to: number): number | null {
  const a = pose[from];
  const b = pose[to];
  if (!isVisible(a) || !isVisible(b)) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const angleFromDown = (Math.atan2(dx, dy) * 180) / Math.PI;
  return Math.abs(angleFromDown);
}

function torsoMid(pose: Pose): { x: number; y: number } | null {
  const lS = pose[LM.LEFT_SHOULDER];
  const rS = pose[LM.RIGHT_SHOULDER];
  const lH = pose[LM.LEFT_HIP];
  const rH = pose[LM.RIGHT_HIP];
  if (!isVisible(lS) || !isVisible(rS) || !isVisible(lH) || !isVisible(rH)) return null;
  return {
    x: (lS.x + rS.x + lH.x + rH.x) / 4,
    y: (lS.y + rS.y + lH.y + rH.y) / 4,
  };
}

function signedHorizontalDeg(pose: Pose, from: number, to: number): number | null {
  const a = pose[from];
  const b = pose[to];
  if (!isVisible(a) || !isVisible(b)) return null;
  return (Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI;
}

export function computeJointAngles(pose: Pose, _worldPose?: WorldPose): JointAngles {
  const mid = torsoMid(pose);
  const angles: JointAngles = {};

  angles.leftElbowBend = jointAngleDeg(pose, LM.LEFT_ELBOW, LM.LEFT_SHOULDER, LM.LEFT_WRIST) ?? undefined;
  angles.rightElbowBend =
    jointAngleDeg(pose, LM.RIGHT_ELBOW, LM.RIGHT_SHOULDER, LM.RIGHT_WRIST) ?? undefined;
  angles.leftKneeBend = jointAngleDeg(pose, LM.LEFT_KNEE, LM.LEFT_HIP, LM.LEFT_ANKLE) ?? undefined;
  angles.rightKneeBend =
    jointAngleDeg(pose, LM.RIGHT_KNEE, LM.RIGHT_HIP, LM.RIGHT_ANKLE) ?? undefined;
  angles.leftShoulderRaise =
    segmentAngleFromVerticalDeg(pose, LM.LEFT_SHOULDER, LM.LEFT_ELBOW) ?? undefined;
  angles.rightShoulderRaise =
    segmentAngleFromVerticalDeg(pose, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW) ?? undefined;
  angles.leftHipFlex = segmentAngleFromVerticalDeg(pose, LM.LEFT_HIP, LM.LEFT_KNEE) ?? undefined;
  angles.rightHipFlex = segmentAngleFromVerticalDeg(pose, LM.RIGHT_HIP, LM.RIGHT_KNEE) ?? undefined;
  angles.leftWristBend =
    jointAngleDeg(pose, LM.LEFT_WRIST, LM.LEFT_ELBOW, LM.LEFT_INDEX) ?? undefined;
  angles.rightWristBend =
    jointAngleDeg(pose, LM.RIGHT_WRIST, LM.RIGHT_ELBOW, LM.RIGHT_INDEX) ?? undefined;
  angles.leftAnkleBend =
    jointAngleDeg(pose, LM.LEFT_ANKLE, LM.LEFT_KNEE, LM.LEFT_FOOT_INDEX) ?? undefined;
  angles.rightAnkleBend =
    jointAngleDeg(pose, LM.RIGHT_ANKLE, LM.RIGHT_KNEE, LM.RIGHT_FOOT_INDEX) ?? undefined;

  if (mid && isVisible(pose[LM.NOSE]) && isVisible(pose[LM.LEFT_SHOULDER])) {
    const smy = (pose[LM.LEFT_SHOULDER]!.y + pose[LM.RIGHT_SHOULDER]!.y) / 2;
    const nose = pose[LM.NOSE]!;
    angles.neckNod = ((nose.y - smy) / Math.max(0.01, Math.abs(nose.x - mid.x) + 0.1)) * 90 + 90;
    const dx = nose.x - mid.x;
    const dy = nose.y - mid.y;
    angles.neckTilt = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (isVisible(pose[LM.LEFT_EAR]) && isVisible(pose[LM.RIGHT_EAR])) {
      const le = pose[LM.LEFT_EAR]!;
      const re = pose[LM.RIGHT_EAR]!;
      angles.headTurn = (Math.atan2(re.x - le.x, re.y - le.y) * 180) / Math.PI;
    }
  }

  if (mid) {
    const smx = (pose[LM.LEFT_SHOULDER]!.x + pose[LM.RIGHT_SHOULDER]!.x) / 2;
    const smy = (pose[LM.LEFT_SHOULDER]!.y + pose[LM.RIGHT_SHOULDER]!.y) / 2;
    const hmx = (pose[LM.LEFT_HIP]!.x + pose[LM.RIGHT_HIP]!.x) / 2;
    const hmy = (pose[LM.LEFT_HIP]!.y + pose[LM.RIGHT_HIP]!.y) / 2;
    angles.torsoLean = signedHorizontalDeg(pose, LM.LEFT_HIP, LM.LEFT_SHOULDER) ?? undefined;
    angles.torsoTilt =
      (Math.atan2(smx - hmx, hmy - smy) * 180) / Math.PI;
    const shoulderWidth = Math.abs(pose[LM.RIGHT_SHOULDER]!.x - pose[LM.LEFT_SHOULDER]!.x);
    const hipWidth = Math.abs(pose[LM.RIGHT_HIP]!.x - pose[LM.LEFT_HIP]!.x);
    if (shoulderWidth > 1e-4) {
      angles.torsoTwist = ((hipWidth - shoulderWidth) / shoulderWidth) * 90;
    }
  }

  const hipY = mid?.y ?? 0.5;
  const leftAnkleY = pose[LM.LEFT_ANKLE]?.y;
  const rightAnkleY = pose[LM.RIGHT_ANKLE]?.y;
  if (leftAnkleY != null) angles.leftLegRaise = Math.max(0, (hipY - leftAnkleY) * 180);
  if (rightAnkleY != null) angles.rightLegRaise = Math.max(0, (hipY - rightAnkleY) * 180);

  if (isVisible(pose[LM.LEFT_WRIST]) && isVisible(pose[LM.LEFT_SHOULDER])) {
    angles.leftArmSpread =
      Math.abs(pose[LM.LEFT_WRIST]!.x - pose[LM.LEFT_SHOULDER]!.x) * 180;
  }
  if (isVisible(pose[LM.RIGHT_WRIST]) && isVisible(pose[LM.RIGHT_SHOULDER])) {
    angles.rightArmSpread =
      Math.abs(pose[LM.RIGHT_WRIST]!.x - pose[LM.RIGHT_SHOULDER]!.x) * 180;
  }

  return angles;
}

function bucket(value: number, thresholds: number[], labels: readonly string[]): string {
  for (let i = 0; i < thresholds.length; i++) {
    if (value < thresholds[i]!) return labels[i]!;
  }
  return labels[labels.length - 1]!;
}

function classifyArchetype(pose: Pose, angles: JointAngles): string {
  const lKnee = angles.leftKneeBend ?? 180;
  const rKnee = angles.rightKneeBend ?? 180;
  const lean = Math.abs(angles.torsoLean ?? 0);
  const hipY =
    torsoMid(pose)?.y ??
    ((pose[LM.LEFT_HIP]?.y ?? 0.5) + (pose[LM.RIGHT_HIP]?.y ?? 0.5)) / 2;
  const ankleY = Math.max(pose[LM.LEFT_ANKLE]?.y ?? 0, pose[LM.RIGHT_ANKLE]?.y ?? 0);
  const kneeY = Math.max(pose[LM.LEFT_KNEE]?.y ?? 0, pose[LM.RIGHT_KNEE]?.y ?? 0);

  if (lean > 55 || hipY > 0.72) return "lying";
  if (lKnee < 55 && rKnee < 55 && kneeY > hipY + 0.05) return "crouching";
  if (lKnee < 75 && rKnee < 75 && kneeY > hipY) return "kneeling";
  if (lKnee < 110 && rKnee < 110 && ankleY > hipY + 0.08) return "sitting";
  if ((angles.leftLegRaise ?? 0) > 35 || (angles.rightLegRaise ?? 0) > 35) return "jumping";
  return "standing";
}

export function classifyLimbStates(angles: JointAngles, pose?: Pose): LimbStates {
  const states: LimbStates = {};

  const armRaise = (v: number | undefined) =>
    bucket(v ?? 25, [25, 55, 85], POSE_VOCAB.leftArm.raise!);
  const armBend = (v: number | undefined) =>
    bucket(180 - (v ?? 180), [30, 75], POSE_VOCAB.leftArm.bend!);
  const legRaise = (v: number | undefined) =>
    bucket(v ?? 0, [12, 35], POSE_VOCAB.leftLeg.raise!);
  const legBend = (v: number | undefined) =>
    bucket(180 - (v ?? 180), [25, 70], POSE_VOCAB.leftLeg.bend!);

  states.leftArm = {
    raise: armRaise(angles.leftShoulderRaise),
    bend: armBend(angles.leftElbowBend),
  };
  states.rightArm = {
    raise: armRaise(angles.rightShoulderRaise),
    bend: armBend(angles.rightElbowBend),
  };
  states.leftLeg = {
    raise: legRaise(angles.leftLegRaise),
    bend: legBend(angles.leftKneeBend),
  };
  states.rightLeg = {
    raise: legRaise(angles.rightLegRaise),
    bend: legBend(angles.rightKneeBend),
  };

  states.torso = {
    lean: (() => {
      const v = angles.torsoLean ?? 0;
      if (Math.abs(v) < 18) return "upright";
      return v > 0 ? "forward" : "back";
    })(),
    tilt: bucket(Math.abs(angles.torsoTilt ?? 0), [8, 18], POSE_VOCAB.torso.tilt!),
    twist: bucket(Math.abs(angles.torsoTwist ?? 0), [12], POSE_VOCAB.torso.twist!),
  };

  states.head = {
    tilt: bucket(Math.abs(angles.neckTilt ?? 0), [8, 20], POSE_VOCAB.head.tilt!),
    nod: bucket(angles.neckNod ?? 90, [75, 105], POSE_VOCAB.head.nod!),
    turn: bucket(Math.abs(angles.headTurn ?? 0), [10, 25], POSE_VOCAB.head.turn!),
  };

  if (pose) {
    states.archetype = { pose: classifyArchetype(pose, angles) };
  }

  return states;
}

export function limbStateToTag(group: string, axis: string, value: string): string {
  return `pose:${group}-${axis}-${value}`;
}

export function limbStatesToTags(states: LimbStates): string[] {
  const tags: string[] = [];
  for (const [group, axes] of Object.entries(states)) {
    if (!axes) continue;
    for (const [axis, value] of Object.entries(axes)) {
      if (value) tags.push(limbStateToTag(group, axis, value));
    }
  }
  return tags;
}

export function parseLimbStateKey(key: string): { group: string; axis: string } | null {
  const dot = key.indexOf(".");
  if (dot === -1) return null;
  return { group: key.slice(0, dot), axis: key.slice(dot + 1) };
}

export function limbStatesFromFilter(
  filter: Record<string, string>,
): LimbStates {
  const states: LimbStates = {};
  for (const [key, value] of Object.entries(filter)) {
    const parsed = parseLimbStateKey(key);
    if (!parsed) continue;
    const group = parsed.group as LimbGroup;
    if (!states[group]) states[group] = {};
    states[group]![parsed.axis] = value;
  }
  return states;
}

export function buildFeatureVector(
  angles: JointAngles,
  pose: Pose,
  mask?: Float32Array,
): Float32Array {
  const vec = new Float32Array(FEATURE_VECTOR_DIM);
  const norm = normalizePose(pose);

  let i = 0;
  for (const key of ORDERED_ANGLE_KEYS) {
    const deg = angles[key];
    const rad = deg != null ? (deg * Math.PI) / 180 : 0;
    vec[i++] = deg != null ? Math.sin(rad) : 0;
    vec[i++] = deg != null ? Math.cos(rad) : 0;
  }

  for (const idx of LANDMARK_FEATURE_INDICES) {
    const p = norm?.[idx] ?? pose[idx];
    vec[i++] = p?.x ?? 0;
    vec[i++] = p?.y ?? 0;
  }

  if (mask) {
    for (let j = 0; j < vec.length; j++) {
      vec[j] = (vec[j] ?? 0) * (mask[j] ?? 0);
    }
  }

  return vec;
}

export function buildLimbMask(activeLimbs?: readonly LimbGroup[]): Float32Array {
  const mask = new Float32Array(FEATURE_VECTOR_DIM).fill(0);
  if (!activeLimbs || activeLimbs.length === 0) {
    mask.fill(1);
    return mask;
  }

  const active = new Set(activeLimbs);
  let i = 0;
  for (const key of ORDERED_ANGLE_KEYS) {
    const limb = ANGLE_TO_LIMB[key];
    const on = limb ? active.has(limb) : false;
    mask[i++] = on ? 1 : 0;
    mask[i++] = on ? 1 : 0;
  }

  for (const idx of LANDMARK_FEATURE_INDICES) {
    const limb = LANDMARK_TO_LIMB[idx] ?? "torso";
    const on = active.has(limb) || (limb !== "torso" && active.has("torso"));
    mask[i++] = on ? 1 : 0;
    mask[i++] = on ? 1 : 0;
  }

  return mask;
}

export function featurizePose(pose: Pose, worldPose?: WorldPose) {
  const angles = computeJointAngles(pose, worldPose);
  const limbStates = classifyLimbStates(angles, pose);
  const embedding = buildFeatureVector(angles, pose);
  return { angles, limbStates, embedding, tags: limbStatesToTags(limbStates) };
}

export function defaultStandingPose(): Pose {
  const pose: Pose = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }));

  const set = (idx: number, x: number, y: number) => {
    pose[idx] = { x, y, z: 0, visibility: 1 };
  };

  set(LM.NOSE, 0.5, 0.18);
  set(LM.LEFT_SHOULDER, 0.42, 0.28);
  set(LM.RIGHT_SHOULDER, 0.58, 0.28);
  set(LM.LEFT_ELBOW, 0.35, 0.42);
  set(LM.RIGHT_ELBOW, 0.65, 0.42);
  set(LM.LEFT_WRIST, 0.32, 0.55);
  set(LM.RIGHT_WRIST, 0.68, 0.55);
  set(LM.LEFT_HIP, 0.44, 0.52);
  set(LM.RIGHT_HIP, 0.56, 0.52);
  set(LM.LEFT_KNEE, 0.43, 0.7);
  set(LM.RIGHT_KNEE, 0.57, 0.7);
  set(LM.LEFT_ANKLE, 0.42, 0.88);
  set(LM.RIGHT_ANKLE, 0.58, 0.88);
  set(LM.LEFT_HEEL, 0.4, 0.9);
  set(LM.RIGHT_HEEL, 0.6, 0.9);
  set(LM.LEFT_FOOT_INDEX, 0.41, 0.93);
  set(LM.RIGHT_FOOT_INDEX, 0.59, 0.93);
  set(LM.LEFT_EAR, 0.46, 0.16);
  set(LM.RIGHT_EAR, 0.54, 0.16);
  set(LM.MOUTH_LEFT, 0.48, 0.21);
  set(LM.MOUTH_RIGHT, 0.52, 0.21);

  return pose;
}

export function maskedCosineSimilarity(
  a: Float32Array | number[],
  b: Float32Array | number[],
  mask?: Float32Array | number[],
): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const m = mask ? (mask[i] ?? 1) : 1;
    if (m === 0) continue;
    const av = a[i]! * m;
    const bv = b[i]! * m;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na < 1e-9 || nb < 1e-9) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
