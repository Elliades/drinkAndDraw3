import type { Pose } from "./types";
import {
  POSE_CONNECTIONS,
  SIDE_COLOR,
  SIDE_OF_LANDMARK,
  connectionSide,
} from "./topology";

export const VISIBILITY_THRESHOLD = 0.3;

export interface DrawOptions {
  /** Width of bone lines in pixels. Auto-scales with image size if omitted. */
  boneWidth?: number;
  /** Radius of keypoint dots. Auto-scales if omitted. */
  pointRadius?: number;
  /**
   * Optional per-keypoint colors. Index i overrides the dot color
   * for landmark i (and edges adjacent to it). `undefined` falls back
   * to side colors.
   */
  colorOverrides?: Array<string | undefined>;
  /**
   * Ghost mode: low opacity, dashed bones, no point fills.
   */
  ghost?: boolean;
  /** Force a single solid color for all bones and dots. */
  uniformColor?: string;
}

export function drawStickFigure(
  ctx: CanvasRenderingContext2D,
  pose: Pose,
  width: number,
  height: number,
  options: DrawOptions = {},
): void {
  const scale = Math.min(width, height);
  const boneWidth = options.boneWidth ?? Math.max(2, scale * 0.006);
  const pointRadius = options.pointRadius ?? Math.max(2.5, scale * 0.008);
  const ghost = options.ghost === true;
  const colorOverrides = options.colorOverrides;
  const uniformColor = options.uniformColor;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (ghost) {
    ctx.globalAlpha = 0.7;
    ctx.setLineDash([Math.max(3, boneWidth * 1.5), Math.max(3, boneWidth)]);
  }

  for (const [a, b] of POSE_CONNECTIONS) {
    const pa = pose[a];
    const pb = pose[b];
    if (!pa || !pb) continue;
    if ((pa.visibility ?? 1) < VISIBILITY_THRESHOLD) continue;
    if ((pb.visibility ?? 1) < VISIBILITY_THRESHOLD) continue;

    let stroke: string;
    if (uniformColor) {
      stroke = uniformColor;
    } else if (colorOverrides) {
      const ca = colorOverrides[a];
      const cb = colorOverrides[b];
      stroke = ca ?? cb ?? SIDE_COLOR[connectionSide(a, b)];
    } else {
      stroke = SIDE_COLOR[connectionSide(a, b)];
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = boneWidth;
    ctx.beginPath();
    ctx.moveTo(pa.x * width, pa.y * height);
    ctx.lineTo(pb.x * width, pb.y * height);
    ctx.stroke();
  }

  if (ghost) {
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }

  for (let i = 0; i < pose.length; i++) {
    const p = pose[i];
    if (!p) continue;
    if ((p.visibility ?? 1) < VISIBILITY_THRESHOLD) continue;

    let fill: string;
    if (uniformColor) {
      fill = uniformColor;
    } else if (colorOverrides && colorOverrides[i]) {
      fill = colorOverrides[i] as string;
    } else {
      fill = SIDE_COLOR[SIDE_OF_LANDMARK[i] ?? "center"];
    }
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, pointRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(1, pointRadius * 0.25);
    ctx.stroke();
  }

  ctx.restore();
}
