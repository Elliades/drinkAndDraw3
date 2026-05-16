import type { Landmark, Pose } from "./types";
import { LM, POSE_LANDMARK_COUNT } from "./topology";

export type Severity = "good" | "warn" | "bad";

export interface AngleDelta {
  jointIndex: number;
  label: string;
  diffDeg: number;
  refDeg: number;
  drwDeg: number;
  severity: Severity;
}

export interface CompareResult {
  /** 0..100 — higher means closer match. */
  score: number;
  /**
   * Per-landmark normalized distance after Procrustes-style centering+scaling.
   * `undefined` for landmarks that weren't visible in both poses.
   */
  jointErrors: Array<number | undefined>;
  /** Sorted descending by `diffDeg`. */
  angleDeltas: AngleDelta[];
  /** Whether the comparison had enough valid points to be meaningful. */
  reliable: boolean;
}

const VISIBILITY_MIN = 0.3;
const SEVERITY_GOOD = 0.05;
const SEVERITY_WARN = 0.12;
const ANGLE_GOOD = 12;
const ANGLE_WARN = 28;

export function severityFor(normalizedDistance: number): Severity {
  if (normalizedDistance < SEVERITY_GOOD) return "good";
  if (normalizedDistance < SEVERITY_WARN) return "warn";
  return "bad";
}

export function severityForAngle(diffDeg: number): Severity {
  if (diffDeg < ANGLE_GOOD) return "good";
  if (diffDeg < ANGLE_WARN) return "warn";
  return "bad";
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  good: "#10b981",
  warn: "#f59e0b",
  bad: "#ef4444",
};

function isVisible(p: Landmark | undefined): p is Landmark {
  return !!p && (p.visibility ?? 1) >= VISIBILITY_MIN;
}

export function normalizePose(pose: Pose): Pose | null {
  const lS = pose[LM.LEFT_SHOULDER];
  const rS = pose[LM.RIGHT_SHOULDER];
  const lH = pose[LM.LEFT_HIP];
  const rH = pose[LM.RIGHT_HIP];

  if (!isVisible(lS) || !isVisible(rS) || !isVisible(lH) || !isVisible(rH)) {
    return null;
  }

  const cx = (lS.x + rS.x + lH.x + rH.x) / 4;
  const cy = (lS.y + rS.y + lH.y + rH.y) / 4;
  const smx = (lS.x + rS.x) / 2;
  const smy = (lS.y + rS.y) / 2;
  const hmx = (lH.x + rH.x) / 2;
  const hmy = (lH.y + rH.y) / 2;
  const scale = Math.hypot(smx - hmx, smy - hmy);

  if (scale < 1e-6) return null;

  return pose.map((p) => ({
    ...p,
    x: (p.x - cx) / scale,
    y: (p.y - cy) / scale,
  }));
}

interface AngleSpec {
  joint: number;
  a: number;
  b: number;
  label: string;
}

const ANGLE_SPECS: AngleSpec[] = [
  { joint: LM.LEFT_ELBOW, a: LM.LEFT_SHOULDER, b: LM.LEFT_WRIST, label: "left elbow" },
  { joint: LM.RIGHT_ELBOW, a: LM.RIGHT_SHOULDER, b: LM.RIGHT_WRIST, label: "right elbow" },
  { joint: LM.LEFT_KNEE, a: LM.LEFT_HIP, b: LM.LEFT_ANKLE, label: "left knee" },
  { joint: LM.RIGHT_KNEE, a: LM.RIGHT_HIP, b: LM.RIGHT_ANKLE, label: "right knee" },
  { joint: LM.LEFT_SHOULDER, a: LM.LEFT_HIP, b: LM.LEFT_ELBOW, label: "left shoulder" },
  { joint: LM.RIGHT_SHOULDER, a: LM.RIGHT_HIP, b: LM.RIGHT_ELBOW, label: "right shoulder" },
  { joint: LM.LEFT_HIP, a: LM.LEFT_SHOULDER, b: LM.LEFT_KNEE, label: "left hip" },
  { joint: LM.RIGHT_HIP, a: LM.RIGHT_SHOULDER, b: LM.RIGHT_KNEE, label: "right hip" },
];

function jointAngleDeg(p: Pose, spec: AngleSpec): number | null {
  const j = p[spec.joint];
  const a = p[spec.a];
  const b = p[spec.b];
  if (!isVisible(j) || !isVisible(a) || !isVisible(b)) return null;
  const ax = a.x - j.x;
  const ay = a.y - j.y;
  const bx = b.x - j.x;
  const by = b.y - j.y;
  const la = Math.hypot(ax, ay);
  const lb = Math.hypot(bx, by);
  if (la < 1e-6 || lb < 1e-6) return null;
  let cos = (ax * bx + ay * by) / (la * lb);
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function comparePoses(ref: Pose, drw: Pose): CompareResult {
  const refN = normalizePose(ref);
  const drwN = normalizePose(drw);

  if (!refN || !drwN) {
    return {
      score: 0,
      jointErrors: new Array<undefined>(POSE_LANDMARK_COUNT).fill(undefined),
      angleDeltas: [],
      reliable: false,
    };
  }

  const jointErrors: Array<number | undefined> = new Array<undefined>(
    POSE_LANDMARK_COUNT,
  ).fill(undefined);
  let sum = 0;
  let count = 0;

  for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
    const r = ref[i];
    const d = drw[i];
    if (!isVisible(r) || !isVisible(d)) continue;
    const rn = refN[i];
    const dn = drwN[i];
    if (!rn || !dn) continue;
    const dist = Math.hypot(rn.x - dn.x, rn.y - dn.y);
    jointErrors[i] = dist;
    sum += dist;
    count += 1;
  }

  const meanDist = count > 0 ? sum / count : 1;
  const score = Math.round(100 * Math.max(0, Math.min(1, 1 - meanDist)));

  const angleDeltas: AngleDelta[] = [];
  for (const spec of ANGLE_SPECS) {
    const r = jointAngleDeg(ref, spec);
    const d = jointAngleDeg(drw, spec);
    if (r == null || d == null) continue;
    const diff = Math.abs(r - d);
    angleDeltas.push({
      jointIndex: spec.joint,
      label: spec.label,
      diffDeg: diff,
      refDeg: r,
      drwDeg: d,
      severity: severityForAngle(diff),
    });
  }
  angleDeltas.sort((a, b) => b.diffDeg - a.diffDeg);

  return {
    score,
    jointErrors,
    angleDeltas,
    reliable: count >= 8,
  };
}

export function jointErrorColors(
  jointErrors: Array<number | undefined>,
): Array<string | undefined> {
  return jointErrors.map((e) =>
    e === undefined ? undefined : SEVERITY_COLORS[severityFor(e)],
  );
}
