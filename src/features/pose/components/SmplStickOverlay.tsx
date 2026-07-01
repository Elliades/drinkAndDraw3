"use client";

import { useEffect, useRef } from "react";
import { drawSmplStickFigure } from "../lib/draw-smpl-stick-figure";

interface SmplStickOverlayProps {
  /** Element we measure to size the canvas. Usually the displayed <img>. */
  target: HTMLElement | null;
  /** 24 SMPL joints normalized [0,1], or undefined to draw nothing. */
  joints2d: number[][] | undefined;
  /** When false, the canvas is cleared (overlay hidden). */
  visible: boolean;
  className?: string;
}

/**
 * Transparent canvas over the reference photo that draws the precomputed SMPL
 * stick figure from `joints2d`. Resolution-independent (joints are normalized),
 * with correct proportions and stable feet from the parametric fit.
 */
export function SmplStickOverlay({
  target,
  joints2d,
  visible,
  className,
}: SmplStickOverlayProps) {
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

      if (visible && joints2d && joints2d.length > 0) {
        drawSmplStickFigure(ctx, joints2d, cssWidth, cssHeight);
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
  }, [target, joints2d, visible]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 m-auto ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}

export default SmplStickOverlay;
