import { describe, expect, it } from "vitest";
import { deduceTagsFromRetrievedText, harmonizeToken, stripStrayHyphens } from "./tagVocabulary";

describe("stripStrayHyphens", () => {
  it("removes trailing hyphen token", () => {
    expect(stripStrayHyphens("12-")).toBe("12");
  });
});

describe("harmonizeToken", () => {
  it("normalizes feet / feets", () => {
    expect(harmonizeToken("feet")).toBe("feet");
    expect(harmonizeToken("feets")).toBe("feet");
  });

  it("normalizes warrior / warriors", () => {
    expect(harmonizeToken("warrior")).toBe("warrior");
    expect(harmonizeToken("warriors")).toBe("warrior");
  });

  it("maps shoes / boots to footwear", () => {
    expect(harmonizeToken("shoes")).toBe("footwear");
    expect(harmonizeToken("boots")).toBe("footwear");
  });

  it("maps wide to wide angle", () => {
    expect(harmonizeToken("wide")).toBe("wide angle");
  });

  it("drops pictures, plus, view, part", () => {
    expect(harmonizeToken("pictures")).toBe("");
    expect(harmonizeToken("plus")).toBe("");
    expect(harmonizeToken("view")).toBe("");
    expect(harmonizeToken("part")).toBe("");
  });
});

describe("deduceTagsFromRetrievedText", () => {
  it("applies vocabulary across path-like text", () => {
    const tags = deduceTagsFromRetrievedText(
      "Albums/Warriors_Feet/wide view plus pictures boots shoes mix",
    );
    expect(tags).toContain("warrior");
    expect(tags).toContain("feet");
    expect(tags).toContain("wide angle");
    expect(tags).toContain("footwear");
    expect(tags).toContain("mixed");
    expect(tags).not.toContain("pictures");
    expect(tags).not.toContain("plus");
    expect(tags).not.toContain("view");
  });
});
