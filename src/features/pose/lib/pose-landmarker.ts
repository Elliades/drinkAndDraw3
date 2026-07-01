import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

// `heavy` is the most accurate of the three MediaPipe variants; the feature
// analyzes one static image on demand, so the extra latency is acceptable.
// Note: still point landmarks, so it cannot recover axial torsion (that is what
// the precomputed HMR mesh path is for) - it only improves landmark/proportion
// approximation over `lite` for the live fallback.
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task";

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

export function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

async function createLandmarker(): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
  try {
    return await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "IMAGE",
      numPoses: 1,
    });
  } catch (gpuErr) {
    console.warn("Pose GPU delegate failed, falling back to CPU:", gpuErr);
    return PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "CPU",
      },
      runningMode: "IMAGE",
      numPoses: 1,
    });
  }
}

export async function detectPose(
  image: HTMLImageElement,
): Promise<PoseLandmarkerResult> {
  const landmarker = await getPoseLandmarker();
  return landmarker.detect(image);
}
