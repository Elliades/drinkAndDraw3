import { describe, expect, it } from "vitest";
import { isValidTagName, normalizeTagList, normalizeTagName } from "./tags";

describe("normalizeTagName", () => {
  it("lowercases", () => {
    expect(normalizeTagName("HAND")).toBe("hand");
  });

  it("trims whitespace", () => {
    expect(normalizeTagName("  portrait  ")).toBe("portrait");
  });

  it("collapses internal whitespace and underscores", () => {
    expect(normalizeTagName("still   life")).toBe("still life");
    expect(normalizeTagName("still_life")).toBe("still life");
  });

  it("strips leading/trailing punctuation", () => {
    expect(normalizeTagName("--hand--")).toBe("hand");
    expect(normalizeTagName("...hand...")).toBe("hand");
  });

  it("returns empty for blank input", () => {
    expect(normalizeTagName("")).toBe("");
    expect(normalizeTagName("   ")).toBe("");
    expect(normalizeTagName("----")).toBe("");
  });

  it("caps length at 64", () => {
    const long = "a".repeat(200);
    expect(normalizeTagName(long).length).toBe(64);
  });

  it("handles non-string input safely", () => {
    // @ts-expect-error - intentional bad input
    expect(normalizeTagName(null)).toBe("");
    // @ts-expect-error - intentional bad input
    expect(normalizeTagName(undefined)).toBe("");
  });
});

describe("normalizeTagList", () => {
  it("normalizes and dedupes", () => {
    expect(normalizeTagList(["Hand", "hand ", " HAND "])).toEqual(["hand"]);
  });

  it("preserves first-seen order", () => {
    expect(normalizeTagList(["b", "a", "B", "a"])).toEqual(["b", "a"]);
  });

  it("drops empties", () => {
    expect(normalizeTagList(["", "  ", "ok"])).toEqual(["ok"]);
  });
});

describe("isValidTagName", () => {
  it("returns true for valid tags", () => {
    expect(isValidTagName("hand")).toBe(true);
  });
  it("returns false for invalid tags", () => {
    expect(isValidTagName("")).toBe(false);
    expect(isValidTagName("   ")).toBe(false);
  });
});
