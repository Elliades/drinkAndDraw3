"use client";

import { useFBX, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Bone,
  Box3,
  Group,
  Object3D,
  SkinnedMesh,
  SkeletonHelper,
  TextureLoader,
  Vector3,
} from "three";
import { clone as cloneSkinnedHierarchy } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  applyLimbRetarget,
  captureBoneRetargetMeta,
  collectBones,
  computeHipMid,
  computeRootFacingQuaternion,
  createRetargetScratch,
  fillWorldLandmarks,
  resetBonesToBind,
  resolveMixamoBone,
  MIXAMO,
} from "./mixamo-y-bot-retarget";
import { applyDiffuseMapToCharacterMeshes } from "./apply-character-diffuse-map";
import {
  DEFAULT_CHARACTER_DIFFUSE_MAP_URL,
  DEFAULT_RIGGED_CHARACTER_MODEL_URL,
  preloadDefaultRiggedCharacterModel,
  riggedModelUsesFbx,
} from "./rigged-model-url";
import { computeRigRootScale } from "./rigged-viewer-scale";

preloadDefaultRiggedCharacterModel();

export interface RiggedBindMetrics {
  bindHeight: number;
  bindLegLen: number;
}

export interface RiggedCharacterProps {
  modelUrl?: string;
  diffuseMapUrl?: string;
  onBindMetrics?: (m: RiggedBindMetrics) => void;
  points: Vector3[];
  visibility: number[];
  showMesh: boolean;
  showSkeletonHelper: boolean;
}

function RiggedCharacterCore({
  source,
  diffuseMapUrl,
  onBindMetrics,
  points,
  visibility,
  showMesh,
  showSkeletonHelper,
}: {
  source: Object3D;
} & Omit<RiggedCharacterProps, "modelUrl">) {
  const clone = useMemo(() => cloneSkinnedHierarchy(source), [source]);
  const rootRef = useRef<Group>(null);
  const skinnedRef = useRef<SkinnedMesh | null>(null);
  const bonesMapRef = useRef<Map<string, Bone>>(new Map());
  const helperRef = useRef<SkeletonHelper | null>(null);
  const worldPtsRef = useRef<Vector3[]>([]);
  const scratchRef = useRef(createRetargetScratch());
  const modelHeightRef = useRef(1.8);
  const modelLegLenRef = useRef(0.95);
  const metaCapturedRef = useRef(false);
  const pivotRef = useRef<Group>(null);

  useEffect(() => {
    for (let i = 0; i < 33; i++) {
      if (!worldPtsRef.current[i]) worldPtsRef.current[i] = new Vector3();
    }
  }, []);

  useEffect(() => {
    metaCapturedRef.current = false;
    let found: SkinnedMesh | undefined;
    clone.traverse((c: Object3D) => {
      if ((c as SkinnedMesh).isSkinnedMesh && !found) {
        found = c as SkinnedMesh;
      }
    });
    skinnedRef.current = found ?? null;
    if (!found) return;

    found.skeleton.pose();
    clone.updateMatrixWorld(true);
    captureBoneRetargetMeta(found.skeleton.bones);
    bonesMapRef.current = collectBones(clone);

    const box = new Box3().setFromObject(clone);
    const h = box.max.y - box.min.y;
    if (h > 1e-3) modelHeightRef.current = h;

    const bones = bonesMapRef.current;
    const hipB = resolveMixamoBone(bones, MIXAMO.HIPS);
    const footB = resolveMixamoBone(bones, MIXAMO.LEFT_FOOT);
    const _a = new Vector3();
    const _b = new Vector3();
    if (hipB && footB) {
      hipB.updateMatrixWorld(true);
      footB.updateMatrixWorld(true);
      hipB.getWorldPosition(_a);
      footB.getWorldPosition(_b);
      const legLen = _a.distanceTo(_b);
      if (legLen > 1e-3) modelLegLenRef.current = legLen;
    }

    metaCapturedRef.current = true;

    onBindMetrics?.({
      bindHeight: modelHeightRef.current,
      bindLegLen: modelLegLenRef.current,
    });

    const pivot = pivotRef.current;
    if (pivot) {
      pivot.position.set(0, 0, 0);
      if (hipB) {
        const w = new Vector3();
        hipB.getWorldPosition(w);
        const hipLocal = w.clone();
        clone.worldToLocal(hipLocal);
        pivot.position.copy(hipLocal).negate();
      }
    }
  }, [clone, onBindMetrics]);

  useEffect(() => {
    const url = diffuseMapUrl?.trim();
    if (!url) return undefined;

    let cancelled = false;
    let restoreMaps: (() => void) | null = null;
    let loadedTexture: import("three").Texture | null = null;
    const loader = new TextureLoader();
    loader.load(
      url,
      (texture) => {
        if (cancelled) {
          texture.dispose();
          return;
        }
        loadedTexture = texture;
        try {
          restoreMaps = applyDiffuseMapToCharacterMeshes(clone, texture);
        } catch (e) {
          console.warn("[RiggedCharacter] apply diffuse map failed", e);
          texture.dispose();
          loadedTexture = null;
        }
      },
      undefined,
      () => {
        console.warn("[RiggedCharacter] diffuse map failed to load:", url);
      },
    );

    return () => {
      cancelled = true;
      restoreMaps?.();
      loadedTexture?.dispose();
    };
  }, [clone, diffuseMapUrl]);

  useEffect(() => {
    const root = rootRef.current;
    const skinned = skinnedRef.current;
    if (!root || !skinned) return;

    const old = helperRef.current;
    if (old) {
      root.remove(old);
      old.geometry.dispose();
      if (Array.isArray(old.material)) old.material.forEach((m) => m.dispose());
      else old.material.dispose();
      helperRef.current = null;
    }

    if (showSkeletonHelper) {
      const helper = new SkeletonHelper(skinned);
      root.add(helper);
      helperRef.current = helper;
    }

    return () => {
      const h = helperRef.current;
      if (h) {
        root.remove(h);
        h.geometry.dispose();
        if (Array.isArray(h.material)) h.material.forEach((m) => m.dispose());
        else h.material.dispose();
        helperRef.current = null;
      }
    };
  }, [showSkeletonHelper, clone]);

  useFrame(() => {
    const root = rootRef.current;
    const skinned = skinnedRef.current;
    const parent = root?.parent;
    const s = scratchRef.current;
    if (!root || !skinned || !parent || !metaCapturedRef.current) return;

    skinned.visible = showMesh;

    const sk = skinned.skeleton;
    resetBonesToBind(sk.bones);

    if (!computeHipMid(points, visibility, s.hipMid)) return;

    const facing = computeRootFacingQuaternion(points, visibility, s);
    if (facing) root.quaternion.copy(facing);
    else root.quaternion.identity();

    root.position.copy(s.hipMid);

    const scale = computeRigRootScale({
      points,
      visibility,
      modelBindHeight: modelHeightRef.current,
      modelBindLegLen: modelLegLenRef.current,
    });
    root.scale.setScalar(scale);

    root.updateMatrixWorld(true);
    parent.updateMatrixWorld(true);

    fillWorldLandmarks(points, visibility, parent.matrixWorld, worldPtsRef.current);

    applyLimbRetarget({
      bones: bonesMapRef.current,
      skeletonBones: sk.bones,
      points,
      visibility,
      worldPoints: worldPtsRef.current,
      scratch: s,
    });

    clone.updateMatrixWorld(true);
    const helper = helperRef.current;
    if (helper) helper.updateMatrixWorld(true);
  });

  return (
    <group ref={rootRef}>
      <group ref={pivotRef}>
        <primitive object={clone} />
      </group>
    </group>
  );
}

function RiggedCharacterFromGltf({
  modelUrl,
  ...rest
}: RiggedCharacterProps & { modelUrl: string }) {
  const { scene } = useGLTF(modelUrl);
  return <RiggedCharacterCore source={scene} {...rest} />;
}

function RiggedCharacterFromFbx({
  modelUrl,
  ...rest
}: RiggedCharacterProps & { modelUrl: string }) {
  const fbx = useFBX(modelUrl);
  return <RiggedCharacterCore source={fbx} {...rest} />;
}

export function RiggedCharacter({
  modelUrl = DEFAULT_RIGGED_CHARACTER_MODEL_URL,
  diffuseMapUrl = DEFAULT_CHARACTER_DIFFUSE_MAP_URL,
  points,
  visibility,
  showMesh,
  showSkeletonHelper,
}: RiggedCharacterProps) {
  if (riggedModelUsesFbx(modelUrl)) {
    return (
      <RiggedCharacterFromFbx
        modelUrl={modelUrl}
        diffuseMapUrl={diffuseMapUrl}
        points={points}
        visibility={visibility}
        showMesh={showMesh}
        showSkeletonHelper={showSkeletonHelper}
      />
    );
  }
  return (
    <RiggedCharacterFromGltf
      modelUrl={modelUrl}
      diffuseMapUrl={diffuseMapUrl}
      points={points}
      visibility={visibility}
      showMesh={showMesh}
      showSkeletonHelper={showSkeletonHelper}
    />
  );
}
