export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type Pose = Landmark[];

/** World-space pose (meters), from MediaPipe `worldLandmarks`. */
export type WorldPose = Landmark[];

/** `anatomy` — 3D mesh over the photo (no 2D canvas overlay). */
export type OverlayMode = "off" | "stick" | "shape" | "both" | "anatomy";

export type PoseAnalysisStatus =
  | "idle"
  | "loading"
  | "ready"
  | "no_pose"
  | "error";

export interface PoseAnalysis {
  status: PoseAnalysisStatus;
  pose?: Pose;
  worldPose?: WorldPose;
  error?: string;
}

/**
 * Precomputed SMPL pose data emitted by the offline NLF tool
 * (tools/pose3d/export_glb.py) and stored per reference. Drives the SMPL stick
 * figure and the anatomical rig with real proportions and axial torsion.
 *
 * Frames:
 * - `pose` is SMPL axis-angle (24 joints x 3 = 72), local rotations relative to
 *   the SMPL rest pose; the root (joint 0) is in the backend's camera frame.
 * - `joints3d` is in the backend's native camera frame (Y-down, Z-forward); the
 *   web side flips Y/Z to Three.js (Y-up) via {@link smplPointToThree}.
 * - `joints2d` is normalized to [0,1] by the source image size (origin top-left).
 */
export interface PoseData {
  version: number;
  backend: string;
  imageWidth: number;
  imageHeight: number;
  /** SMPL axis-angle pose, length 72 (24 joints x 3). */
  pose: number[];
  /** SMPL shape coefficients, length 10 (optional). */
  betas?: number[];
  /** 24 SMPL joints in the backend's native camera frame. */
  joints3d: number[][];
  /** 24 SMPL joints normalized to [0,1] by image size (optional). */
  joints2d?: number[][];
}
