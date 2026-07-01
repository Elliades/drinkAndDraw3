import { describe, expect, it } from "vitest";
import {
  FEATURE_VECTOR_DIM,
  classifyLimbStates,
  computeJointAngles,
  defaultStandingPose,
  featurizePose,
  limbStatesToTags,
} from "@/features/pose/lib/pose-features";

describe("pose-features", () => {
  it("featurizes default standing pose", () => {
    const pose = defaultStandingPose();
    const { angles, limbStates, embedding, tags } = featurizePose(pose);
    expect(embedding.length).toBe(FEATURE_VECTOR_DIM);
    expect(Object.keys(angles).length).toBeGreaterThan(0);
    expect(limbStates.archetype?.pose).toBe("standing");
    expect(tags.some((t) => t.startsWith("pose:"))).toBe(true);
  });

  it("classifies raised arms when wrists are high", () => {
    const pose = defaultStandingPose();
    pose[15] = { x: 0.32, y: 0.12, z: 0, visibility: 1 };
    pose[16] = { x: 0.68, y: 0.12, z: 0, visibility: 1 };
    pose[13] = { x: 0.35, y: 0.2, z: 0, visibility: 1 };
    pose[14] = { x: 0.65, y: 0.2, z: 0, visibility: 1 };
    const angles = computeJointAngles(pose);
    const states = classifyLimbStates(angles, pose);
    expect(states.leftArm?.raise).toBe("overhead");
    expect(states.rightArm?.raise).toBe("overhead");
    expect(limbStatesToTags(states)).toContain("pose:leftArm-raise-overhead");
  });
});
