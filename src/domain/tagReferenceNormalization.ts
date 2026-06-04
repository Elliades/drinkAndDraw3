/**
 * Per-reference tag normalization after folder-level deduce / tag.txt sync.
 *
 * - Drops noise tag `part`.
 * - Pure numeric tags (`1`, `2`, …) become `female N` / `male N` when gender tags exist.
 * - Bare numerics without gender context are kept and flagged for manual review.
 */

import { normalizeTagList } from "./tags";

export const DROPPED_REFERENCE_TAGS = new Set(["part"]);

const GENDER_FEMALE = "female";
const GENDER_MALE = "male";

const PURE_NUMERIC = /^\d+$/;

export type TagReviewReason = "bare_numeric";

export type NormalizeTagSetResult = {
  tags: string[];
  needsReview: boolean;
  reviewReason?: TagReviewReason;
  /** Numeric tags that stayed bare (no female/male on the reference). */
  bareNumericTags: string[];
};

export function isPureNumericTag(name: string): boolean {
  return PURE_NUMERIC.test(name);
}

function compoundTag(gender: string, digit: string): string {
  return `${gender} ${digit}`;
}

/**
 * Normalize a tag list for one reference. Input names should already pass `normalizeTagName`.
 */
export function normalizeTagSetForReference(rawTags: readonly string[]): NormalizeTagSetResult {
  const input = normalizeTagList(
    rawTags.filter((t) => !DROPPED_REFERENCE_TAGS.has(t)),
  );

  const hasFemale = input.includes(GENDER_FEMALE);
  const hasMale = input.includes(GENDER_MALE);
  const bareNumericTags: string[] = [];
  const out: string[] = [];

  for (const tag of input) {
    if (!isPureNumericTag(tag)) {
      out.push(tag);
      continue;
    }

    if (hasFemale || hasMale) {
      if (hasFemale) out.push(compoundTag(GENDER_FEMALE, tag));
      if (hasMale) out.push(compoundTag(GENDER_MALE, tag));
      continue;
    }

    bareNumericTags.push(tag);
    out.push(tag);
  }

  const tags = normalizeTagList(out);
  const needsReview = bareNumericTags.length > 0;

  return {
    tags,
    needsReview,
    reviewReason: needsReview ? "bare_numeric" : undefined,
    bareNumericTags,
  };
}
