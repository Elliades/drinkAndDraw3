import { describe, expect, it } from "vitest";
import {
  isPureNumericTag,
  normalizeTagSetForReference,
} from "./tagReferenceNormalization";

describe("isPureNumericTag", () => {
  it("matches digit-only tags", () => {
    expect(isPureNumericTag("1")).toBe(true);
    expect(isPureNumericTag("17")).toBe(true);
  });

  it("rejects non-numeric tags", () => {
    expect(isPureNumericTag("female 1")).toBe(false);
    expect(isPureNumericTag("part")).toBe(false);
  });
});

describe("normalizeTagSetForReference", () => {
  it("drops part", () => {
    const r = normalizeTagSetForReference(["female", "part", "1"]);
    expect(r.tags).toEqual(["female", "female 1"]);
    expect(r.tags).not.toContain("part");
  });

  it("replaces 1 with female 1 when female present", () => {
    const r = normalizeTagSetForReference(["female", "1", "sketching"]);
    expect(r.tags).toContain("female");
    expect(r.tags).toContain("female 1");
    expect(r.tags).toContain("sketching");
    expect(r.tags).not.toContain("1");
    expect(r.needsReview).toBe(false);
  });

  it("replaces 1 with male 1 when male present", () => {
    const r = normalizeTagSetForReference(["male", "1"]);
    expect(r.tags).toEqual(["male", "male 1"]);
  });

  it("adds both compounds when female and male present", () => {
    const r = normalizeTagSetForReference(["female", "male", "1"]);
    expect(r.tags).toContain("female");
    expect(r.tags).toContain("male");
    expect(r.tags).toContain("female 1");
    expect(r.tags).toContain("male 1");
    expect(r.tags).not.toContain("1");
  });

  it("keeps bare 1 and flags review when no gender", () => {
    const r = normalizeTagSetForReference(["1", "sketching"]);
    expect(r.tags).toContain("1");
    expect(r.tags).toContain("sketching");
    expect(r.needsReview).toBe(true);
    expect(r.reviewReason).toBe("bare_numeric");
    expect(r.bareNumericTags).toEqual(["1"]);
  });

  it("handles multiple numeric tags", () => {
    const r = normalizeTagSetForReference(["female", "1", "2"]);
    expect(r.tags).toContain("female 1");
    expect(r.tags).toContain("female 2");
    expect(r.tags).not.toContain("1");
    expect(r.tags).not.toContain("2");
  });
});
