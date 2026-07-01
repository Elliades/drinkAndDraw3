"use client";

import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { Box3, Mesh, MeshStandardMaterial, Vector3, type Object3D } from "three";

import { SMPL_VIEWER_TARGET_SIZE } from "../lib/smpl";

const TARGET_HEIGHT = SMPL_VIEWER_TARGET_SIZE;

/**
 * NLF / HMR posed body mesh (.glb) — proportions and torsion baked into vertices.
 * This is the original “3D from the image” representation (no Mixamo retarget).
 */
function useFramedMesh(meshUrl: string, wireframe: boolean): Object3D {
  const { scene } = useGLTF(meshUrl);

  return useMemo(() => {
    const root = scene.clone(true);

    const box = new Box3().setFromObject(root);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);

    root.position.sub(center);

    const height = size.y;
    if (height > 1e-6) {
      const scale = TARGET_HEIGHT / height;
      root.scale.setScalar(scale);
      root.position.multiplyScalar(scale);
    }

    root.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const mat of materials) {
        const standard = mat as MeshStandardMaterial;
        if ("wireframe" in standard) standard.wireframe = wireframe;
      }
    });

    return root;
  }, [scene, wireframe]);
}

export function PrecomputedMeshScene({
  meshUrl,
  wireframe = false,
}: {
  meshUrl: string;
  wireframe?: boolean;
}) {
  useEffect(() => {
    useGLTF.preload(meshUrl);
  }, [meshUrl]);

  const object = useFramedMesh(meshUrl, wireframe);
  return <primitive object={object} />;
}

export default PrecomputedMeshScene;
