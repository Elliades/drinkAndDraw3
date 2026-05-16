/**
 * MediaPipe Pose Landmark topology.
 *
 * The Pose Landmarker model emits 33 landmarks. See:
 * https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
 */

export const LM = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

export type Side = "left" | "right" | "center";

export const POSE_LANDMARK_COUNT = 33;

const sides: Side[] = new Array<Side>(POSE_LANDMARK_COUNT).fill("center");
const leftIndices = [1, 2, 3, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31];
const rightIndices = [
  4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32,
];
for (const i of leftIndices) sides[i] = "left";
for (const i of rightIndices) sides[i] = "right";
export const SIDE_OF_LANDMARK: ReadonlyArray<Side> = sides;

/**
 * Bone connections drawn for the stick figure. Mirrors the official
 * `PoseLandmarker.POSE_CONNECTIONS` set, listed explicitly here so we don't
 * depend on the value at import time (it's a runtime property of the class).
 */
export const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [LM.LEFT_EYE_INNER, LM.LEFT_EYE],
  [LM.LEFT_EYE, LM.LEFT_EYE_OUTER],
  [LM.LEFT_EYE_OUTER, LM.LEFT_EAR],
  [LM.RIGHT_EYE_INNER, LM.RIGHT_EYE],
  [LM.RIGHT_EYE, LM.RIGHT_EYE_OUTER],
  [LM.RIGHT_EYE_OUTER, LM.RIGHT_EAR],
  [LM.MOUTH_LEFT, LM.MOUTH_RIGHT],
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.LEFT_WRIST, LM.LEFT_PINKY],
  [LM.LEFT_WRIST, LM.LEFT_INDEX],
  [LM.LEFT_WRIST, LM.LEFT_THUMB],
  [LM.LEFT_PINKY, LM.LEFT_INDEX],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.RIGHT_WRIST, LM.RIGHT_PINKY],
  [LM.RIGHT_WRIST, LM.RIGHT_INDEX],
  [LM.RIGHT_WRIST, LM.RIGHT_THUMB],
  [LM.RIGHT_PINKY, LM.RIGHT_INDEX],
  [LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.LEFT_ANKLE, LM.LEFT_HEEL],
  [LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX],
  [LM.LEFT_ANKLE, LM.LEFT_FOOT_INDEX],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE],
  [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  [LM.RIGHT_ANKLE, LM.RIGHT_HEEL],
  [LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX],
  [LM.RIGHT_ANKLE, LM.RIGHT_FOOT_INDEX],
];

function sideOf(index: number): Side {
  return SIDE_OF_LANDMARK[index] ?? "center";
}

export function connectionSide(a: number, b: number): Side {
  const sa = sideOf(a);
  const sb = sideOf(b);
  if (sa === sb) return sa;
  if (sa === "center") return sb;
  if (sb === "center") return sa;
  return "center";
}

export const SIDE_COLOR: Record<Side, string> = {
  left: "#3b82f6",
  right: "#ef4444",
  center: "#10b981",
};
