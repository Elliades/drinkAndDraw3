"use client";

import { useEffect, useRef } from "react";
import type { OverlayMode, Pose } from "../lib/types";
import { drawStickFigure } from "../lib/draw-stick-figure";
import { drawSimplifiedShape } from "../lib/draw-simplified-shape";

interface PoseOverlayProps {
  /** Element we measure to size the canvas. Usually the displayed <img>. */
  target: HTMLElement | null;
  pose: Pose | undefined;
  mode: OverlayMode;
  /** Overrides keypoint colors (e.g. by error severity). */
  jointErrorColors?: Array<string | undefined>;
  /** Optional ghost skeleton drawn on top. */
  ghostPose?: Pose;
  ghostColor?: string;
  className?: string;
}

export function PoseOverlay({
  target,
  pose,
  mode,
  jointErrorColors,
  ghostPose,
  ghostColor = "#60a5fa",
  className,
}: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !target) return;

    let frame = 0;

    const render = () => {
      const rect = target.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = rect.width;
      const cssHeight = rect.height;

      if (cssWidth === 0 || cssHeight === 0) return;

      const targetW = Math.round(cssWidth * dpr);
      const targetH = Math.round(cssHeight * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const drawingActive =
        mode !== "off" && mode !== "anatomy" && !!pose;

      if (drawingActive && pose) {
        if (mode === "shape" || mode === "both") {
          drawSimplifiedShape(ctx, pose, cssWidth, cssHeight);
        }
        if (mode === "stick" || mode === "both") {
          drawStickFigure(ctx, pose, cssWidth, cssHeight, {
            colorOverrides: jointErrorColors,
          });
        }
      }

      if (ghostPose) {
        drawStickFigure(ctx, ghostPose, cssWidth, cssHeight, {
          ghost: true,
          uniformColor: ghostColor,
        });
      }
    };

    const scheduleRender = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };

    scheduleRender();

    const ro = new ResizeObserver(scheduleRender);
    ro.observe(target);
    window.addEventListener("resize", scheduleRender);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", scheduleRender);
    };
  }, [target, pose, mode, jointErrorColors, ghostPose, ghostColor]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 m-auto ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}
