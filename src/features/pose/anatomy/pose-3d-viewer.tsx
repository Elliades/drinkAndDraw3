"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import {
  Suspense,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import { Button } from "@/ui/button";
import { cn } from "@/lib/utils";
import type { PoseData } from "../lib/types";
import { smplGlobalQuatsInThree, smplJoints3dToThree } from "../lib/smpl";
import { PrecomputedMeshScene } from "./precomputed-mesh-scene";
import { RiggedCharacter } from "./rigged-character";
import { SmplStick3D } from "./smpl-stick-3d";

export interface Pose3DViewerProps {
  /** Precomputed HMR / NLF posed mesh (.glb) from the reference image. */
  meshUrl?: string | null;
  /** Precomputed SMPL pose JSON (joints + axis-angle pose). */
  poseData?: PoseData | null;
  showHmrMesh: boolean;
  showAnatomy: boolean;
  showAnatomyBones: boolean;
  showStick3d: boolean;
  showSpatialFit: boolean;
}

function ToggleChip({
  pressed,
  onClick,
  label,
  disabled,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        pressed
          ? "border-primary bg-primary/20 text-primary"
          : "border-border/80 bg-background/80 text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/**
 * Orbitable 3D stack: HMR mesh (from image), optional muscle rig, optional 3D stick.
 * Layers are controlled by the parent; sub-toggles here are anatomy/mesh options only.
 */
export function Pose3DViewer({
  meshUrl,
  poseData,
  showHmrMesh,
  showAnatomy,
  showAnatomyBones,
  showStick3d,
  showSpatialFit,
}: Pose3DViewerProps) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls> | null>(null);
  const [hmrWireframe, setHmrWireframe] = useState(false);

  const stickJoints = useMemo(
    () => (poseData ? smplJoints3dToThree(poseData.joints3d) : []),
    [poseData],
  );
  const stickQuats = useMemo(
    () => (poseData ? smplGlobalQuatsInThree(poseData.pose) : []),
    [poseData],
  );

  const hasHmr = !!meshUrl && showHmrMesh;
  const needsRig = !!poseData && (showAnatomy || showAnatomyBones || showSpatialFit);
  const hasAnatomy = needsRig;
  const hasStick = !!poseData && showStick3d;

  return (
    <div className="relative h-full min-h-0 w-full">
      <Canvas
        className="h-full w-full touch-none"
        camera={{ position: [0, 0.2, 2.4], fov: 35, near: 0.05, far: 50 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl, scene }) => {
          scene.background = null;
          gl.setClearColor(0x000000, 0);
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2.5, 4, 3]} intensity={1.1} />
        <directionalLight position={[-2, 1.5, -1.5]} intensity={0.35} />

        <Suspense fallback={null}>
          {hasHmr && meshUrl && (
            <PrecomputedMeshScene meshUrl={meshUrl} wireframe={hmrWireframe} />
          )}
          {hasAnatomy && poseData && (
            <RiggedCharacter
              showMesh={showAnatomy || showSpatialFit}
              showSkeletonHelper={showAnatomyBones}
              smplPose={poseData.pose}
              smplJoints3d={poseData.joints3d}
              smplSpatialFit={showSpatialFit}
            />
          )}
          {hasStick && poseData && (
            <SmplStick3D joints={stickJoints} globalQuats={stickQuats} />
          )}
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={0.5}
          maxDistance={10}
          target={[0, 0, 0]}
        />
      </Canvas>

      <div
        className="pointer-events-none absolute left-2 right-2 top-2 z-10 flex flex-wrap gap-1 [&>button]:pointer-events-auto"
        role="group"
        aria-label="3D viewer options"
      >
        {meshUrl && showHmrMesh && (
          <>
            <ToggleChip
              pressed={!hmrWireframe}
              onClick={() => setHmrWireframe(false)}
              label="Solid mesh"
            />
            <ToggleChip
              pressed={hmrWireframe}
              onClick={() => setHmrWireframe(true)}
              label="Wire mesh"
            />
          </>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 bg-gradient-to-t from-background/90 to-transparent px-2 py-1.5 pt-6 text-[11px] text-muted-foreground [&>button]:pointer-events-auto">
        <span className="pointer-events-none">
          Drag orbit · right-drag pan · scroll zoom
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => controlsRef.current?.reset()}
        >
          Reset view
        </Button>
      </div>
    </div>
  );
}

export default Pose3DViewer;
