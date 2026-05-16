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
