"use client";

import { useEffect } from "react";
import { detectPose } from "@/features/pose/lib/pose-landmarker";
import type { Pose, WorldPose } from "@/features/pose/lib/types";

declare global {
  interface Window {
    __poseHarnessReady?: boolean;
    __detectPoseFromUrl?: (url: string) => Promise<{
      ok: boolean;
      pose?: Pose;
      worldPose?: WorldPose;
      error?: string;
    }>;
  }
}

export default function PoseHarnessPage() {
  useEffect(() => {
    window.__detectPoseFromUrl = async (url: string) => {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
          img.src = url;
        });
        const result = await detectPose(img);
        const pose = result.landmarks?.[0] as Pose | undefined;
        const worldPose = result.worldLandmarks?.[0] as WorldPose | undefined;
        if (!pose) return { ok: false, error: "no_pose" };
        return { ok: true, pose, worldPose };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    };
    window.__poseHarnessReady = true;
    return () => {
      delete window.__detectPoseFromUrl;
      delete window.__poseHarnessReady;
    };
  }, []);

  return (
    <div className="p-4 text-sm text-muted-foreground">
      Pose detection harness — tooling only.
    </div>
  );
}
