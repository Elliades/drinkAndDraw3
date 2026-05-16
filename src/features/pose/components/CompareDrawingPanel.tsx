"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/ui/button";
import { crossOriginForImgSrc } from "@/lib/img-cross-origin";
import { cn } from "@/lib/utils";
import { detectPose } from "../lib/pose-landmarker";
import { comparePoses, jointErrorColors } from "../lib/compare-pose";
import type { CompareResult } from "../lib/compare-pose";
import type { Pose, PoseAnalysis } from "../lib/types";
import { PoseOverlay } from "./PoseOverlay";
import { ScoreBadge } from "./ScoreBadge";
import { JointChip } from "./JointChip";

interface Props {
  referenceSrc: string;
  referencePose: Pose;
  referenceLabel: string;
}

interface DrawingState {
  src: string;
  name: string;
  analysis: PoseAnalysis;
}

export function CompareDrawingPanel({
  referenceSrc,
  referencePose,
  referenceLabel,
}: Props) {
  const [drawing, setDrawing] = useState<DrawingState | null>(null);
  const [showGhost, setShowGhost] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [drawingDisplayEl, setDrawingDisplayEl] =
    useState<HTMLImageElement | null>(null);
  const [refImgEl, setRefImgEl] = useState<HTMLImageElement | null>(null);

  /**
   * Tracks the active blob URL so we can cancel stale analysis results when
   * the user replaces or detaches the drawing before analysis finishes.
   */
  const activeSrcRef = useRef<string | null>(null);

  /**
   * Tracks the blob URL to revoke on unmount. Updated on every render so the
   * cleanup always sees the latest value even though the effect runs once.
   */
  const currentBlobRef = useRef<string | null>(null);
  currentBlobRef.current = drawing?.src.startsWith("blob:")
    ? drawing.src
    : null;

  // Revoke the current blob URL only when the panel unmounts.
  // We use an empty-deps effect so the cleanup runs exactly once on unmount,
  // and read currentBlobRef.current (a ref, not a closure-captured value) to
  // get the latest blob at that moment.
  /**
   * Run pose detection on a new drawing entirely imperatively — no React DOM
   * element involved. This avoids a bug where a useEffect depending on
   * [drawing] would run its cleanup (setting cancelled=true, clearing
   * img.onload) the moment the first setDrawing() call inside it triggered a
   * re-render, permanently hanging the load promise.
   */
  const analyzeDrawing = useCallback(
    async (src: string, _name: string): Promise<void> => {
      // Create a throwaway Image element outside React's render tree.
      const img = new window.Image();
      const co = crossOriginForImgSrc(src);
      if (co) img.crossOrigin = co;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () =>
          reject(new Error("Could not load the image file."));
        img.src = src;
      });

      // If the user attached a different file while we were loading, bail.
      if (activeSrcRef.current !== src) return;

      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        setDrawing((cur) =>
          cur?.src === src
            ? {
                ...cur,
                analysis: {
                  status: "error",
                  error:
                    "Image has no pixel dimensions. Try a different file or format.",
                },
              }
            : cur,
        );
        return;
      }

      try {
        const result = await detectPose(img);
        if (activeSrcRef.current !== src) return;

        const pose = result.landmarks?.[0] as Pose | undefined;
        if (!pose || pose.length === 0) {
          setDrawing((cur) =>
            cur?.src === src
              ? { ...cur, analysis: { status: "no_pose" } }
              : cur,
          );
          return;
        }
        setDrawing((cur) =>
          cur?.src === src
            ? { ...cur, analysis: { status: "ready", pose } }
            : cur,
        );
      } catch (err) {
        if (activeSrcRef.current !== src) return;
        console.error("Drawing pose detection failed:", err);
        setDrawing((cur) =>
          cur?.src === src
            ? {
                ...cur,
                analysis: {
                  status: "error",
                  error: err instanceof Error ? err.message : String(err),
                },
              }
            : cur,
        );
      }
    },
    [],
  );

  const attachFile = useCallback(
    (file: File) => {
      const src = URL.createObjectURL(file);

      // Revoke the previous blob before overwriting the ref.
      const prev = currentBlobRef.current;
      if (prev?.startsWith("blob:") && prev !== src) {
        URL.revokeObjectURL(prev);
      }

      activeSrcRef.current = src;
      setDrawing({ src, name: file.name, analysis: { status: "loading" } });
      void analyzeDrawing(src, file.name);
    },
    [analyzeDrawing],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (list[0]) attachFile(list[0]);
    },
    [attachFile],
  );

  const detach = useCallback(() => {
    activeSrcRef.current = null;
    const prev = currentBlobRef.current;
    if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
    currentBlobRef.current = null;
    setDrawing(null);
    setDrawingDisplayEl(null);
  }, []);

  const drawingPose: Pose | undefined =
    drawing?.analysis.status === "ready" ? drawing.analysis.pose : undefined;

  const compare: CompareResult | null = useMemo(
    () => (drawingPose ? comparePoses(referencePose, drawingPose) : null),
    [referencePose, drawingPose],
  );

  const drawingErrorColors = useMemo(
    () => (compare ? jointErrorColors(compare.jointErrors) : undefined),
    [compare],
  );

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!drawing) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed bg-card p-4 transition-colors",
          dragActive ? "border-primary bg-primary/5" : "border-border",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Attach your drawing</p>
          <p className="text-xs text-muted-foreground">
            Drop an image here or pick a file to compare poses.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          Choose drawing
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  // ── Drawing attached ───────────────────────────────────────────────────────
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="truncate text-xs text-muted-foreground">
          Drawing: <span className="text-foreground">{drawing.name}</span>
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            Replace
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={detach}>
            Detach
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {drawing.analysis.status === "loading" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Analyzing drawing…
        </p>
      )}

      {drawing.analysis.status === "no_pose" && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            No pose detected in this drawing. MediaPipe works best on clear
            figure drawings; very stylized sketches may fail.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const src = drawing.src;
              const name = drawing.name;
              activeSrcRef.current = src;
              setDrawing({ src, name, analysis: { status: "loading" } });
              void analyzeDrawing(src, name);
            }}
          >
            Retry
          </Button>
        </div>
      )}

      {drawing.analysis.status === "error" && (
        <p className="text-sm text-destructive">
          Detection failed: {drawing.analysis.error}
        </p>
      )}

      {compare && drawingPose && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <ScoreBadge value={compare.score} reliable={compare.reliable} />
            <div className="flex flex-wrap gap-1.5">
              {compare.angleDeltas.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Not enough shared landmarks to score joints.
                </span>
              ) : (
                compare.angleDeltas
                  .slice(0, 4)
                  .map((d) => <JointChip key={d.jointIndex} delta={d} />)
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ComparePane
              label="Reference"
              src={referenceSrc}
              alt={referenceLabel}
              onImgEl={setRefImgEl}
              imgEl={refImgEl}
              pose={referencePose}
              errorColors={undefined}
              ghostPose={undefined}
            />
            <ComparePane
              label="Drawing"
              src={drawing.src}
              alt={drawing.name}
              onImgEl={setDrawingDisplayEl}
              imgEl={drawingDisplayEl}
              pose={drawingPose}
              errorColors={drawingErrorColors}
              ghostPose={showGhost ? referencePose : undefined}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showGhost}
              onChange={(e) => setShowGhost(e.target.checked)}
            />
            Overlay reference target on drawing
          </label>
        </>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface ComparePaneProps {
  label: string;
  src: string;
  alt: string;
  onImgEl: (el: HTMLImageElement | null) => void;
  imgEl: HTMLImageElement | null;
  pose: Pose;
  errorColors: Array<string | undefined> | undefined;
  ghostPose: Pose | undefined;
}

function ComparePane({
  label,
  src,
  alt,
  onImgEl,
  imgEl,
  pose,
  errorColors,
  ghostPose,
}: ComparePaneProps) {
  return (
    <figure className="space-y-1">
      <div className="relative aspect-[4/5] overflow-hidden rounded-md border border-border bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={onImgEl}
          src={src}
          alt={alt}
          crossOrigin={crossOriginForImgSrc(src)}
          className="h-full w-full object-contain"
        />
        <PoseOverlay
          target={imgEl}
          pose={pose}
          mode="stick"
          jointErrorColors={errorColors}
          ghostPose={ghostPose}
        />
      </div>
      <figcaption className="text-center text-[11px] text-muted-foreground">
        {label}
      </figcaption>
    </figure>
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
