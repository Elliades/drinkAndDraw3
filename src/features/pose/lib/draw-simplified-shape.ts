import type { Landmark, Pose } from "./types";
import { LM } from "./topology";

const VISIBLE = 0.3;

interface Point {
  x: number;
  y: number;
}

function toPx(lm: Landmark, w: number, h: number): Point {
  return { x: lm.x * w, y: lm.y * h };
}

function isVisible(lm: Landmark | undefined): lm is Landmark {
  return !!lm && (lm.visibility ?? 1) >= VISIBLE;
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function drawCapsule(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  thickness: number,
): void {
  ctx.beginPath();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = thickness;
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

export function drawSimplifiedShape(
  ctx: CanvasRenderingContext2D,
  pose: Pose,
  width: number,
  height: number,
): void {
  const lShoulder = pose[LM.LEFT_SHOULDER];
  const rShoulder = pose[LM.RIGHT_SHOULDER];
  const lHip = pose[LM.LEFT_HIP];
  const rHip = pose[LM.RIGHT_HIP];

  if (
    !isVisible(lShoulder) ||
    !isVisible(rShoulder) ||
    !isVisible(lHip) ||
    !isVisible(rHip)
  ) {
    return;
  }

  const ls = toPx(lShoulder, width, height);
  const rs = toPx(rShoulder, width, height);
  const lh = toPx(lHip, width, height);
  const rh = toPx(rHip, width, height);

  const shoulderSpan = distance(ls, rs);
  const torsoHeight = distance(midpoint(ls, rs), midpoint(lh, rh));
  const limbThickness = Math.max(6, Math.min(shoulderSpan, torsoHeight) * 0.32);
  const armThickness = limbThickness * 0.85;

  ctx.save();

  const fill = "rgba(16, 185, 129, 0.28)";
  const stroke = "rgba(16, 185, 129, 0.95)";

  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;

  ctx.beginPath();
  ctx.moveTo(ls.x, ls.y);
  ctx.lineTo(rs.x, rs.y);
  ctx.lineTo(rh.x, rh.y);
  ctx.lineTo(lh.x, lh.y);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = Math.max(2, limbThickness * 0.18);
  ctx.stroke();

  const nose = pose[LM.NOSE];
  const lEar = pose[LM.LEFT_EAR];
  const rEar = pose[LM.RIGHT_EAR];

  let headCenter: Point;
  let headRadius: number;

  if (isVisible(lEar) && isVisible(rEar)) {
    const le = toPx(lEar, width, height);
    const re = toPx(rEar, width, height);
    headCenter = midpoint(le, re);
    headRadius = distance(le, re) * 0.9;
  } else if (isVisible(nose)) {
    headCenter = toPx(nose, width, height);
    headRadius = shoulderSpan * 0.35;
  } else {
    const shoulderMid = midpoint(ls, rs);
    const hipMid = midpoint(lh, rh);
    const dx = shoulderMid.x - hipMid.x;
    const dy = shoulderMid.y - hipMid.y;
    headCenter = { x: shoulderMid.x + dx * 0.35, y: shoulderMid.y + dy * 0.35 };
    headRadius = shoulderSpan * 0.35;
  }

  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.beginPath();
  ctx.arc(headCenter.x, headCenter.y, headRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(2, limbThickness * 0.18);
  ctx.stroke();

  const neckBase = midpoint(ls, rs);
  ctx.strokeStyle = fill;
  drawCapsule(ctx, headCenter, neckBase, limbThickness * 0.55);

  const limbs: Array<{ a: number; b: number; thickness: number }> = [
    { a: LM.LEFT_SHOULDER, b: LM.LEFT_ELBOW, thickness: armThickness },
    { a: LM.LEFT_ELBOW, b: LM.LEFT_WRIST, thickness: armThickness * 0.85 },
    { a: LM.RIGHT_SHOULDER, b: LM.RIGHT_ELBOW, thickness: armThickness },
    { a: LM.RIGHT_ELBOW, b: LM.RIGHT_WRIST, thickness: armThickness * 0.85 },
    { a: LM.LEFT_HIP, b: LM.LEFT_KNEE, thickness: limbThickness },
    { a: LM.LEFT_KNEE, b: LM.LEFT_ANKLE, thickness: limbThickness * 0.9 },
    { a: LM.RIGHT_HIP, b: LM.RIGHT_KNEE, thickness: limbThickness },
    { a: LM.RIGHT_KNEE, b: LM.RIGHT_ANKLE, thickness: limbThickness * 0.9 },
  ];

  ctx.strokeStyle = fill;
  for (const limb of limbs) {
    const a = pose[limb.a];
    const b = pose[limb.b];
    if (!isVisible(a) || !isVisible(b)) continue;
    drawCapsule(
      ctx,
      toPx(a, width, height),
      toPx(b, width, height),
      limb.thickness,
    );
  }

  ctx.restore();
}
