"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/ui/button";
import { cn } from "@/lib/utils";
import { detectPose } from "../lib/pose-landmarker";
import type {
  OverlayMode,
  Pose,
  PoseAnalysis,
} from "../lib/types";
import { PoseOverlay } from "./PoseOverlay";
import { CompareDrawingPanel } from "./CompareDrawingPanel";

interface Props {
  src: string;
  alt?: string;
  className?: string;
  /**
   * Pass a stable identifier for the displayed image. When it changes, the
   * pose analysis + overlay + compare panel reset (used by practice session).
   */
  resetKey?: string;
}

export function PoseAnalyzer({
  src,
  alt,
  className,
  resetKey,
}: Props) {
  const [analysis, setAnalysis] = useState<PoseAnalysis>({ status: "idle" });
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("off");
  const [compareOpen, setCompareOpen] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);

  // Reset when the image switches (practice session advancing).
  useEffect(() => {
    setAnalysis({ status: "idle" });
    setOverlayMode("off");
    setCompareOpen(false);
  }, [resetKey, src]);

  const analyze = useCallback(async () => {
    const img = imgRef.current;
    if (!img) return;

    setAnalysis({ status: "loading" });

    try {
      if (!img.complete || img.naturalWidth === 0) {
        await img.decode();
      }
    } catch {
      // detect will surface a clearer error below
    }

    try {
      const result = await detectPose(img);
      const pose = result.landmarks?.[0] as Pose | undefined;
      if (!pose || pose.length === 0) {
        setAnalysis({ status: "no_pose" });
        setOverlayMode("off");
        return;
      }
      setAnalysis({ status: "ready", pose });
      setOverlayMode((prev) => (prev === "off" ? "stick" : prev));
    } catch (err) {
      console.error("Pose detection failed:", err);
      setAnalysis({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const ready = analysis.status === "ready" && !!analysis.pose;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative overflow-hidden rounded-lg border border-border bg-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={(el) => {
            imgRef.current = el;
            setImgEl(el);
          }}
          src={src}
          alt={alt ?? ""}
          crossOrigin="anonymous"
          className="block h-auto w-full object-contain"
        />
        <PoseOverlay
          target={imgEl}
          pose={analysis.pose}
          mode={ready ? overlayMode : "off"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {analysis.status === "idle" && (
          <Button type="button" onClick={analyze} size="sm">
            Analyze pose
          </Button>
        )}

        {analysis.status === "loading" && (
          <Button type="button" disabled size="sm">
            <Spinner />
            Analyzing...
          </Button>
        )}

        {analysis.status === "no_pose" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>No human pose detected.</span>
            <Button type="button" variant="ghost" size="sm" onClick={analyze}>
              Retry
            </Button>
          </div>
        )}

        {analysis.status === "error" && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <span>Detection failed: {analysis.error}</span>
            <Button type="button" variant="ghost" size="sm" onClick={analyze}>
              Retry
            </Button>
          </div>
        )}

        {ready && (
          <>
            <div
              className="flex flex-wrap gap-1"
              role="group"
              aria-label="Pose overlay mode"
            >
              <ModeToggle
                active={overlayMode === "stick"}
                onClick={() => setOverlayMode("stick")}
                label="Stick"
              />
              <ModeToggle
                active={overlayMode === "shape"}
                onClick={() => setOverlayMode("shape")}
                label="Shape"
              />
              <ModeToggle
                active={overlayMode === "both"}
                onClick={() => setOverlayMode("both")}
                label="Both"
              />
              <ModeToggle
                active={overlayMode === "off"}
                onClick={() => setOverlayMode("off")}
                label="Hide"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCompareOpen((o) => !o)}
              aria-expanded={compareOpen}
            >
              {compareOpen ? "Hide comparison" : "Compare drawing"}
            </Button>
          </>
        )}
      </div>

      {ready && compareOpen && analysis.pose && (
        <CompareDrawingPanel
          referenceSrc={src}
          referencePose={analysis.pose}
          referenceLabel={alt ?? ""}
        />
      )}
    </div>
  );
}

interface ModeToggleProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

function ModeToggle({ active, onClick, label }: ModeToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  );
}
