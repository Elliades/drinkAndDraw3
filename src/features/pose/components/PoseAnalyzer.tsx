"use client";



import dynamic from "next/dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/ui/button";

import { crossOriginForImgSrc } from "@/lib/img-cross-origin";

import { cn } from "@/lib/utils";

import { detectPose } from "../lib/pose-landmarker";

import type { OverlayMode, Pose, PoseAnalysis, WorldPose } from "../lib/types";

import { PoseOverlay } from "./PoseOverlay";

import { SmplStickOverlay } from "./SmplStickOverlay";

import { CompareDrawingPanel } from "./CompareDrawingPanel";

import type { PoseData } from "../lib/types";



const PoseAnatomyOverlay = dynamic(

  () =>

    import(

      /* webpackChunkName: "pose-anatomy-overlay" */

      "@/features/pose/anatomy/pose-anatomy-overlay"

    ),

  {

    ssr: false,

    loading: () => (

      <div className="flex h-full min-h-[120px] items-center justify-center bg-background/50 text-xs text-muted-foreground">

        Loading 3D anatomy…

      </div>

    ),

  },

);



const Pose3DViewer = dynamic(

  () =>

    import(

      /* webpackChunkName: "pose-3d-viewer" */

      "@/features/pose/anatomy/pose-3d-viewer"

    ),

  {

    ssr: false,

    loading: () => (

      <div className="flex h-full min-h-[120px] items-center justify-center bg-background/50 text-xs text-muted-foreground">

        Loading 3D viewer…

      </div>

    ),

  },

);



/** Independent SMPL / 3D layer toggles (can be combined). */

interface SmplLayers {

  stick2d: boolean;

  /** NLF HMR mesh baked from the reference image (.glb). */

  hmrMesh3d: boolean;

  /** Muscle rig driven by SMPL pose JSON. */

  anatomy3d: boolean;

  stick3d: boolean;

  anatomyBones: boolean;

  /** Align muscle rig to SMPL joint positions (joints3d), not bind-length scaling. */
  spatialFit: boolean;

}



const DEFAULT_SMPL_LAYERS: SmplLayers = {

  stick2d: false,

  hmrMesh3d: false,

  anatomy3d: false,

  stick3d: false,

  anatomyBones: false,

  spatialFit: false,

};



interface Props {

  src: string;

  alt?: string;

  className?: string;

  resetKey?: string;

  /** SMPL pose JSON — 2D stick, 3D anatomy rig, 3D stick. */

  poseDataUrl?: string | null;

  /** HMR posed mesh (.glb) — original 3D body from the image. */

  poseMeshUrl?: string | null;

}



export function PoseAnalyzer({

  src,

  alt,

  className,

  resetKey,

  poseDataUrl,

  poseMeshUrl,

}: Props) {

  const [analysis, setAnalysis] = useState<PoseAnalysis>({ status: "idle" });

  const [mpOverlayMode, setMpOverlayMode] = useState<OverlayMode>("off");

  const [layers, setLayers] = useState<SmplLayers>(DEFAULT_SMPL_LAYERS);

  const [showMpAnatomy, setShowMpAnatomy] = useState(false);

  const [compareOpen, setCompareOpen] = useState(false);

  const [smplData, setSmplData] = useState<PoseData | null>(null);



  const imgCrossOrigin = useMemo(() => crossOriginForImgSrc(src), [src]);

  const imgRef = useRef<HTMLImageElement | null>(null);

  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);



  const hasPoseData = !!poseDataUrl;

  const hasPoseMesh = !!poseMeshUrl;



  const toggleLayer = useCallback((key: keyof SmplLayers) => {

    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  }, []);



  useEffect(() => {

    setAnalysis({ status: "idle" });

    setMpOverlayMode("off");

    setLayers(DEFAULT_SMPL_LAYERS);

    setShowMpAnatomy(false);

    setCompareOpen(false);

  }, [resetKey, src]);



  useEffect(() => {

    if (!poseDataUrl) {

      setSmplData(null);

      return;

    }

    let cancelled = false;

    setSmplData(null);

    fetch(poseDataUrl)

      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))

      .then((data: PoseData) => {

        if (!cancelled) setSmplData(data);

      })

      .catch(() => {

        if (!cancelled) setSmplData(null);

      });

    return () => {

      cancelled = true;

    };

  }, [poseDataUrl]);



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

      const worldPose = result.worldLandmarks?.[0] as WorldPose | undefined;

      if (!pose || pose.length === 0) {

        setAnalysis({ status: "no_pose" });

        setMpOverlayMode("off");

        return;

      }

      setAnalysis({ status: "ready", pose, worldPose });

      setMpOverlayMode((prev) => (prev === "off" ? "stick" : prev));

    } catch (err) {

      console.error("Pose detection failed:", err);

      setAnalysis({

        status: "error",

        error: err instanceof Error ? err.message : String(err),

      });

    }

  }, []);



  const ready = analysis.status === "ready" && !!analysis.pose;



  const needsRig =

    layers.anatomy3d || layers.anatomyBones || layers.spatialFit;

  const show3dStack =

    layers.hmrMesh3d || layers.stick3d || needsRig;



  const showMpAnatomyOverlay =

    showMpAnatomy && ready && !show3dStack;



  const mpCanvasMode: OverlayMode =

    ready && !hasPoseData ? mpOverlayMode : ready ? mpOverlayMode : "off";



  const anyLayerOn =

    layers.stick2d ||

    layers.hmrMesh3d ||

    layers.anatomy3d ||

    layers.stick3d ||

    layers.anatomyBones ||

    layers.spatialFit ||

    showMpAnatomy ||

    (ready && mpOverlayMode !== "off");



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

          crossOrigin={imgCrossOrigin}

          className="relative z-0 block h-auto w-full object-contain"

        />



        {show3dStack && (hasPoseData || hasPoseMesh) && (

          <div

            className="absolute inset-0 z-[1] min-h-[200px]"

            aria-label="3D pose viewer"

          >

            <Pose3DViewer

              meshUrl={poseMeshUrl}

              poseData={smplData}

              showHmrMesh={layers.hmrMesh3d}

              showAnatomy={layers.anatomy3d}

              showAnatomyBones={layers.anatomyBones}

              showStick3d={layers.stick3d}

              showSpatialFit={layers.spatialFit}

            />

          </div>

        )}



        {showMpAnatomyOverlay && (

          <div

            className="absolute inset-0 z-[1] min-h-[200px]"

            aria-label="3D Anatomy Browser"

          >

            <PoseAnatomyOverlay

              worldPose={analysis.worldPose}

              pose={analysis.pose}

            />

          </div>

        )}



        <PoseOverlay

          target={imgEl}

          pose={analysis.pose}

          mode={hasPoseData ? (mpCanvasMode === "shape" || mpCanvasMode === "both" ? mpCanvasMode : "off") : mpCanvasMode}

        />



        {hasPoseData && (

          <SmplStickOverlay

            target={imgEl}

            joints2d={smplData?.joints2d}

            visible={layers.stick2d}

            className="z-[2]"

          />

        )}

      </div>



      <div className="flex flex-wrap items-center gap-2">

        {analysis.status === "idle" && !hasPoseData && !hasPoseMesh && (

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



        {(hasPoseData || hasPoseMesh || ready) && (

          <>

            <div

              className="flex flex-wrap gap-1"

              role="group"

              aria-label="Pose layers"

            >

              {hasPoseData && (

                <LayerToggle

                  active={layers.stick2d}

                  onClick={() => toggleLayer("stick2d")}

                  label="2D stick"

                  title="SMPL stick on the photo (joints2d)"

                />

              )}

              {hasPoseMesh && (

                <LayerToggle

                  active={layers.hmrMesh3d}

                  onClick={() => toggleLayer("hmrMesh3d")}

                  label="3D mesh"

                  title="Body mesh recovered from this image (NLF / HMR .glb)"

                />

              )}

              {hasPoseData && (

                <>

                  <LayerToggle

                    active={layers.anatomy3d}

                    onClick={() => toggleLayer("anatomy3d")}

                    label="3D anatomy"

                    title="Muscle rig posed from SMPL parameters"

                  />

                  <LayerToggle

                    active={layers.stick3d}

                    onClick={() => toggleLayer("stick3d")}

                    label="3D stick"

                    title="Oriented SMPL stick in the 3D viewer"

                  />

                  <LayerToggle

                    active={layers.anatomyBones}

                    onClick={() => toggleLayer("anatomyBones")}

                    label="Bones"

                    title="Skeleton helper on the muscle rig"

                  />

                  <LayerToggle

                    active={layers.spatialFit}

                    onClick={() => toggleLayer("spatialFit")}

                    label="Fit to SMPL"

                    title="Scale and aim the rig at SMPL joint positions (same data as 2D/3D stick)"

                  />

                </>

              )}



              {ready && !hasPoseData && (

                <>

                  <LayerToggle

                    active={mpOverlayMode === "stick" || mpOverlayMode === "both"}

                    onClick={() =>

                      setMpOverlayMode((m) =>

                        m === "stick" || m === "both" ? "off" : "stick",

                      )

                    }

                    label="Stick"

                  />

                  <LayerToggle

                    active={mpOverlayMode === "shape" || mpOverlayMode === "both"}

                    onClick={() =>

                      setMpOverlayMode((m) =>

                        m === "shape" || m === "both" ? "off" : "shape",

                      )

                    }

                    label="Shape"

                  />

                  <LayerToggle

                    active={mpOverlayMode === "both"}

                    onClick={() =>

                      setMpOverlayMode((m) => (m === "both" ? "off" : "both"))

                    }

                    label="Both"

                  />

                  <LayerToggle

                    active={showMpAnatomy}

                    onClick={() => setShowMpAnatomy((v) => !v)}

                    label="3D anatomy"

                    title="Live MediaPipe + Mixamo retarget"

                  />

                </>

              )}



              {anyLayerOn && (

                <LayerToggle

                  active={false}

                  onClick={() => {

                    setLayers(DEFAULT_SMPL_LAYERS);

                    setMpOverlayMode("off");

                    setShowMpAnatomy(false);

                  }}

                  label="Hide all"

                />

              )}

            </div>



            {!hasPoseData && !hasPoseMesh && ready && (

              <Button type="button" variant="ghost" size="sm" onClick={analyze}>

                Re-analyze

              </Button>

            )}



            {ready && (

              <Button

                type="button"

                variant="outline"

                size="sm"

                onClick={() => setCompareOpen((o) => !o)}

                aria-expanded={compareOpen}

              >

                {compareOpen ? "Hide comparison" : "Compare drawing"}

              </Button>

            )}

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



function LayerToggle({

  active,

  onClick,

  label,

  title,

}: {

  active: boolean;

  onClick: () => void;

  label: string;

  title?: string;

}) {

  return (

    <button

      type="button"

      aria-pressed={active}

      title={title}

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


