"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import {
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import { Quaternion, Vector3 } from "three";
import { Button } from "@/ui/button";
import { cn } from "@/lib/utils";
import type { Pose, WorldPose } from "../lib/types";
import {
  POSE_CONNECTIONS,
  SIDE_COLOR,
  SIDE_OF_LANDMARK,
  connectionSide,
} from "../lib/topology";
import { VISIBILITY_THRESHOLD } from "../lib/draw-stick-figure";
import { computeHipMid } from "./mixamo-y-bot-retarget";
import {
  DEFAULT_CHARACTER_DIFFUSE_MAP_URL,
  DEFAULT_RIGGED_CHARACTER_MODEL_URL,
} from "./rigged-model-url";
import { computeRigRootScale } from "./rigged-viewer-scale";
import { RiggedCharacter, type RiggedBindMetrics } from "./rigged-character";

export interface PoseAnatomyOverlayProps {
  worldPose?: WorldPose;
  pose?: Pose;
  characterModelUrl?: string;
  characterDiffuseMapUrl?: string;
}

function toPoints(
  worldPose: WorldPose | undefined,
  pose: Pose | undefined,
): Vector3[] | null {
  if (worldPose && worldPose.length > 0) {
    return worldPose.map((lm) => new Vector3(lm.x, -lm.y, -lm.z));
  }
  if (pose && pose.length > 0) {
    const leftHip = pose[23];
    const rightHip = pose[24];
    const cx =
      leftHip && rightHip ? (leftHip.x + rightHip.x) / 2 : 0.5;
    const cy =
      leftHip && rightHip ? (leftHip.y + rightHip.y) / 2 : 0.5;
    const SCALE = 1.7;
    return pose.map(
      (lm) =>
        new Vector3((lm.x - cx) * SCALE, -(lm.y - cy) * SCALE, -lm.z * SCALE),
    );
  }
  return null;
}

function bboxCenterVisible(
  points: Vector3[],
  visibility: number[],
): Vector3 | null {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  let any = false;
  for (let i = 0; i < points.length; i++) {
    if ((visibility[i] ?? 1) < VISIBILITY_THRESHOLD) continue;
    const p = points[i];
    if (!p) continue;
    any = true;
    min.min(p);
    max.max(p);
  }
  if (!any) return null;
  return new Vector3().addVectors(min, max).multiplyScalar(0.5);
}

function buildScenePoints(
  points: Vector3[],
  visibility: number[],
): Vector3[] {
  const pivot = new Vector3();
  if (computeHipMid(points, visibility, pivot)) {
    return points.map((p) => (p ? p.clone().sub(pivot) : new Vector3()));
  }
  const bc = bboxCenterVisible(points, visibility);
  if (bc) {
    return points.map((p) => (p ? p.clone().sub(bc) : new Vector3()));
  }
  return points.map((p) => (p ? p.clone() : new Vector3()));
}

interface BoneProps {
  from: Vector3;
  to: Vector3;
  color: string;
  radius: number;
}

function Bone({ from, to, color, radius }: BoneProps) {
  const direction = useMemo(() => new Vector3().subVectors(to, from), [from, to]);
  const length = direction.length();
  const mid = useMemo(
    () => new Vector3().addVectors(from, to).multiplyScalar(0.5),
    [from, to],
  );
  const quaternion = useMemo(() => {
    const q = new Quaternion();
    if (length === 0) return q;
    q.setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize());
    return q;
  }, [direction, length]);

  if (length === 0) return null;

  return (
    <mesh position={mid} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
    </mesh>
  );
}

function Skeleton({
  points,
  visibility,
  radiusScale,
}: {
  points: Vector3[];
  visibility: number[];
  radiusScale: number;
}) {
  const jointRadius = 0.025 * radiusScale;
  const boneRadius = 0.014 * radiusScale;

  return (
    <group>
      {POSE_CONNECTIONS.map(([a, b], i) => {
        const pa = points[a];
        const pb = points[b];
        if (!pa || !pb) return null;
        if ((visibility[a] ?? 1) < VISIBILITY_THRESHOLD) return null;
        if ((visibility[b] ?? 1) < VISIBILITY_THRESHOLD) return null;
        const color = SIDE_COLOR[connectionSide(a, b)];
        return (
          <Bone
            key={`b-${i}`}
            from={pa}
            to={pb}
            color={color}
            radius={boneRadius}
          />
        );
      })}
      {points.map((p, i) => {
        if ((visibility[i] ?? 1) < VISIBILITY_THRESHOLD) return null;
        const side = SIDE_OF_LANDMARK[i] ?? "center";
        const color = SIDE_COLOR[side];
        return (
          <mesh key={`j-${i}`} position={p}>
            <sphereGeometry args={[jointRadius, 16, 16]} />
            <meshStandardMaterial
              color={color}
              roughness={0.3}
              metalness={0.2}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function ToggleChip({
  pressed,
  onClick,
  label,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
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
 * Transparent WebGL layer over the reference photo (3D Anatomy Browser).
 */
function PoseAnatomyOverlay({
  worldPose,
  pose,
  characterModelUrl = DEFAULT_RIGGED_CHARACTER_MODEL_URL,
  characterDiffuseMapUrl = DEFAULT_CHARACTER_DIFFUSE_MAP_URL,
}: PoseAnatomyOverlayProps) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls> | null>(null);
  const [showCharacter, setShowCharacter] = useState(true);
  const [showRigHelper, setShowRigHelper] = useState(false);
  const [showStick, setShowStick] = useState(false);

  const points = useMemo(() => toPoints(worldPose, pose), [worldPose, pose]);
  const visibility = useMemo(() => {
    const src = worldPose && worldPose.length > 0 ? worldPose : pose;
    return src ? src.map((lm) => lm.visibility ?? 1) : [];
  }, [worldPose, pose]);

  const [bindMetrics, setBindMetrics] = useState<RiggedBindMetrics>({
    bindHeight: 1.8,
    bindLegLen: 0.95,
  });

  const handleBindMetrics = useCallback((m: RiggedBindMetrics) => {
    setBindMetrics((prev) =>
      Math.abs(prev.bindHeight - m.bindHeight) < 1e-4 &&
      Math.abs(prev.bindLegLen - m.bindLegLen) < 1e-4
        ? prev
        : m,
    );
  }, []);

  const scenePoints = useMemo(() => {
    if (!points || points.length === 0) return null;
    return buildScenePoints(points, visibility);
  }, [points, visibility]);

  const stickRadiusScale = useMemo(() => {
    if (!scenePoints) return 1;
    return computeRigRootScale({
      points: scenePoints,
      visibility,
      modelBindHeight: bindMetrics.bindHeight,
      modelBindLegLen: bindMetrics.bindLegLen,
    });
  }, [scenePoints, visibility, bindMetrics]);

  const handleReset = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.reset();
  };

  if (!points || !scenePoints) {
    return (
      <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
        No 3D landmarks for anatomy view.
      </div>
    );
  }

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
          <group>
            {(showCharacter || showRigHelper || showStick) && (
              <RiggedCharacter
                modelUrl={characterModelUrl}
                diffuseMapUrl={characterDiffuseMapUrl}
                onBindMetrics={handleBindMetrics}
                points={scenePoints}
                visibility={visibility}
                showMesh={showCharacter}
                showSkeletonHelper={showRigHelper}
              />
            )}
            {showStick && (
              <Skeleton
                points={scenePoints}
                visibility={visibility}
                radiusScale={stickRadiusScale}
              />
            )}
          </group>
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
        aria-label="3D anatomy layers"
      >
        <ToggleChip
          pressed={showCharacter}
          onClick={() => setShowCharacter((v) => !v)}
          label="Mesh"
        />
        <ToggleChip
          pressed={showRigHelper}
          onClick={() => setShowRigHelper((v) => !v)}
          label="Bones"
        />
        <ToggleChip
          pressed={showStick}
          onClick={() => setShowStick((v) => !v)}
          label="Stick"
        />
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
          onClick={handleReset}
        >
          Reset view
        </Button>
      </div>
    </div>
  );
}

export { PoseAnatomyOverlay };
export default PoseAnatomyOverlay;
