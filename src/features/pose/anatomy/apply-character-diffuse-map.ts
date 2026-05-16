import type { Object3D, Texture } from "three";
import {
  Mesh,
  MeshLambertMaterial,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
} from "three";

/**
 * Assigns `map` to all mesh materials under `root` that support a diffuse map,
 * and returns a function that restores previous maps (does not dispose `map`).
 */
export function applyDiffuseMapToCharacterMeshes(
  root: Object3D,
  map: Texture,
): () => void {
  map.colorSpace = SRGBColorSpace;
  map.flipY = true;

  const restores: Array<() => void> = [];

  root.traverse((o) => {
    const msh = o as Mesh;
    if (!msh.isMesh) return;
    const mats = Array.isArray(msh.material) ? msh.material : [msh.material];
    for (const mat of mats) {
      if (
        mat instanceof MeshStandardMaterial ||
        mat instanceof MeshPhysicalMaterial ||
        mat instanceof MeshPhongMaterial ||
        mat instanceof MeshLambertMaterial
      ) {
        const old = mat.map;
        mat.map = map;
        mat.needsUpdate = true;
        restores.push(() => {
          mat.map = old;
          mat.needsUpdate = true;
        });
      }
    }
  });

  return () => {
    for (const r of restores) r();
  };
}
