import { describe, expect, it } from "vitest";
import {
  filenameFromKey,
  folderPathFromKey,
  titleFromFilename,
} from "./storage-keys";

describe("folderPathFromKey", () => {
  it("parses simple keys", () => {
    expect(folderPathFromKey("Hands/Closed/a.jpg")).toBe("Hands/Closed");
  });
  it("returns empty for root-level files", () => {
    expect(folderPathFromKey("a.jpg")).toBe("");
  });
  it("handles backslashes", () => {
    expect(folderPathFromKey("Hands\\Closed\\a.jpg")).toBe("Hands/Closed");
  });
});

describe("filenameFromKey", () => {
  it("returns the leaf name", () => {
    expect(filenameFromKey("Hands/Closed/a.jpg")).toBe("a.jpg");
  });
  it("handles root-level", () => {
    expect(filenameFromKey("a.jpg")).toBe("a.jpg");
  });
});

describe("titleFromFilename", () => {
  it("strips extension and prettifies", () => {
    expect(titleFromFilename("hand_pose_01.jpg")).toBe("hand pose 01");
  });
  it("normalizes hyphens", () => {
    expect(titleFromFilename("hand-pose-01.png")).toBe("hand pose 01");
  });
});
