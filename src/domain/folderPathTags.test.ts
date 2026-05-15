import { describe, it, expect } from "vitest";
import { deriveTagsFromFolderPath } from "./folderPathTags";

describe("deriveTagsFromFolderPath", () => {
  it("extracts daily, female, wide view, sample pack from nested path", () => {
    const tags = deriveTagsFromFolderPath("Daily Sketching Female 7.wide view/Sample Pack");
    expect(tags).toContain("daily");
    expect(tags).toContain("sketching");
    expect(tags).toContain("female");
    expect(tags).toContain("wide view");
    expect(tags).toContain("sample pack");
  });

  it("handles hyphenated male-female folder names", () => {
    const tags = deriveTagsFromFolderPath("Warriors - Male-Female/Dynamic poses");
    expect(tags).toContain("dynamic poses");
    expect(tags).toContain("warriors");
    expect(tags).toContain("male");
    expect(tags).toContain("female");
  });

  it("returns empty for root", () => {
    expect(deriveTagsFromFolderPath("")).toEqual([]);
  });

  it("skips paths that are only __MACOSX", () => {
    expect(deriveTagsFromFolderPath("__MACOSX")).toEqual([]);
  });
});
