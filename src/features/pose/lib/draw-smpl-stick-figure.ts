/**
 * 2D stick-figure drawing from precomputed SMPL `joints2d`.
 *
 * Unlike the MediaPipe drawer ({@link drawStickFigure}), this uses the 24
 * anatomically-constrained SMPL joints (normalized [0,1] by image size), giving
 * correct proportions and stable feet, plus a real spine chain and collars.
 */

import { SIDE_COLOR } from "./topology";
import { SMPL_CONNECTIONS, smplConnectionSide, smplJointSide } from "./smpl";

export interface DrawSmplOptions {
  /** Width of bone lines in pixels. Auto-scales with image size if omitted. */
  boneWidth?: number;
  /** Radius of keypoint dots. Auto-scales if omitted. */
  pointRadius?: number;
  /** Force a single solid color for all bones and dots. */
  uniformColor?: string;
}

/**
 * Draw the SMPL stick figure. `joints2d` are 24 [u,v] pairs normalized to
 * [0,1]; they are scaled by the canvas CSS size. Points at exactly (0,0) are
 * treated as missing and skipped.
 */
export function drawSmplStickFigure(
  ctx: CanvasRenderingContext2D,
  joints2d: number[][],
  width: number,
  height: number,
  options: DrawSmplOptions = {},
): void {
  const scale = Math.min(width, height);
  const boneWidth = options.boneWidth ?? Math.max(2, scale * 0.006);
  const pointRadius = options.pointRadius ?? Math.max(2.5, scale * 0.008);
  const uniformColor = options.uniformColor;

  const present = (j: number): boolean => {
    const p = joints2d[j];
    return (
      Array.isArray(p) &&
      p.length >= 2 &&
      Number.isFinite(p[0]!) &&
      Number.isFinite(p[1]!)
    );
  };

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const [a, b] of SMPL_CONNECTIONS) {
    if (!present(a) || !present(b)) continue;
    const pa = joints2d[a]!;
    const pb = joints2d[b]!;
    ctx.strokeStyle = uniformColor ?? SIDE_COLOR[smplConnectionSide(a, b)];
    ctx.lineWidth = boneWidth;
    ctx.beginPath();
    ctx.moveTo(pa[0]! * width, pa[1]! * height);
    ctx.lineTo(pb[0]! * width, pb[1]! * height);
    ctx.stroke();
  }

  for (let i = 0; i < joints2d.length; i++) {
    if (!present(i)) continue;
    const p = joints2d[i]!;
    ctx.fillStyle = uniformColor ?? SIDE_COLOR[smplJointSide(i)];
    ctx.beginPath();
    ctx.arc(p[0]! * width, p[1]! * height, pointRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(1, pointRadius * 0.25);
    ctx.stroke();
  }

  ctx.restore();
}
