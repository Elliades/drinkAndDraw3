import { useFBX, useGLTF } from "@react-three/drei";

/**
 * Default rigged character under `public/models/`. Override with
 * `NEXT_PUBLIC_CHARACTER_MODEL_URL` (e.g. another `.glb` / `.fbx`).
 */
export const DEFAULT_RIGGED_CHARACTER_MODEL_URL: string =
  process.env.NEXT_PUBLIC_CHARACTER_MODEL_URL ??
  "/models/t-pose-female-anatomy.fbx";

export const DEFAULT_CHARACTER_DIFFUSE_MAP_URL: string | undefined =
  typeof process.env.NEXT_PUBLIC_CHARACTER_DIFFUSE_MAP_URL === "string" &&
  process.env.NEXT_PUBLIC_CHARACTER_DIFFUSE_MAP_URL.trim() !== ""
    ? process.env.NEXT_PUBLIC_CHARACTER_DIFFUSE_MAP_URL.trim()
    : undefined;

/** Whether the URL points to an FBX file (case-insensitive, ignores `?` / `#`). */
export function riggedModelUsesFbx(url: string): boolean {
  const pathOnly = url.split(/[?#]/)[0] ?? url;
  return pathOnly.toLowerCase().endsWith(".fbx");
}

export function preloadDefaultRiggedCharacterModel(): void {
  const url = DEFAULT_RIGGED_CHARACTER_MODEL_URL;
  if (riggedModelUsesFbx(url)) {
    useFBX.preload(url);
  } else {
    useGLTF.preload(url);
  }
}
