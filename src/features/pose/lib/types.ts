export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type Pose = Landmark[];

export type OverlayMode = "off" | "stick" | "shape" | "both";

export type PoseAnalysisStatus =
  | "idle"
  | "loading"
  | "ready"
  | "no_pose"
  | "error";

export interface PoseAnalysis {
  status: PoseAnalysisStatus;
  pose?: Pose;
  error?: string;
}
