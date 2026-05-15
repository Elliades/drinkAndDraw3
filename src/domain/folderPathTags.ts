/**
 * Derive human-readable search tags from a reference `folderPath` (no filename).
 *
 * Example:
 *   `Daily Sketching Female 7.wide view/Sample Pack`
 *   → daily, sketching, female, wide view, sample pack (and other meaningful tokens)
 */

import { normalizeFolderPath } from "@/domain/folders";
import { normalizeTagList, normalizeTagName } from "@/domain/tags";

/** Lowercase tokens → canonical tag (single word or short phrase). */
const TOKEN_ALIASES: Record<string, string> = {
  woman: "female",
  women: "female",
  girl: "female",
  fem: "female",
  man: "male",
  men: "male",
  boy: "male",
  duo: "duo",
  pair: "duo",
  couple: "duo",
  trio: "trio",
  hand: "hands",
  foot: "feet",
  feet: "feet",
  turnaround: "360",
  turntable: "360",
};

/** Multi-word phrases detected inside a normalized (lowercase) segment string. */
const KNOWN_PHRASES: readonly string[] = [
  "wide view",
  "sample pack",
  "head and hair",
  "portraits and emotions",
  "dynamic poses",
  "static poses",
  "couple poses",
  "male hands",
  "female hands",
  "male-female",
  "t pose",
  "t poses",
  "a poses",
  "c poses",
  "with the sword",
  "with the rifles",
  "with the ax",
  "with the stick",
  "with daggers",
  "with swords",
  "with guns",
  "with a pistol",
  "with a spear",
  "with a big katana",
  "without weapons",
  "on the knee with the rifles",
];

const STOPWORDS = new Set([
  "",
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "for",
  "with",
  "by",
  "at",
  "as",
  "from",
  "into",
  "on",
  "vs",
  "v",
  "no",
  "set",
  "pack",
  "sample",
  "img",
  "image",
  "copy",
  "final",
  "edit",
]);

const NOISE_SEGMENT = /^(?:__MACOSX|\.DS_Store)$/i;

function stripVersionDots(segment: string): string {
  return segment.replace(/(\d+)\./g, " ");
}

function segmentToPhraseHaystack(segment: string): string {
  let s = stripVersionDots(segment);
  s = s.replace(/\./g, " ");
  s = s.replace(/[-_/]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s.toLowerCase();
}

function splitWords(haystack: string): string[] {
  return haystack
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ""))
    .filter((w) => w.length > 0);
}

function isNoiseToken(w: string): boolean {
  if (w.length <= 1 && !/\d/.test(w)) return true;
  if (/^\d+$/.test(w)) return true;
  if (NOISE_SEGMENT.test(w)) return true;
  return false;
}

/**
 * Tags derived only from directory path segments (not filename).
 */
export function deriveTagsFromFolderPath(folderPath: string): string[] {
  const norm = normalizeFolderPath(folderPath);
  if (!norm) return [];

  const rawCandidates: string[] = [];
  const segments = norm.split("/").filter((s) => s.length > 0 && !NOISE_SEGMENT.test(s));

  for (const seg of segments) {
    const segLower = seg.toLowerCase();
    for (const phrase of KNOWN_PHRASES) {
      if (segLower.includes(phrase)) rawCandidates.push(phrase);
      const hyphenated = phrase.replace(/\s+/g, "-");
      if (hyphenated !== phrase && segLower.includes(hyphenated)) rawCandidates.push(phrase);
    }

    const hay = segmentToPhraseHaystack(seg);
    if (!hay) continue;

    const words = splitWords(hay);
    for (const w of words) {
      if (isNoiseToken(w)) continue;
      if (STOPWORDS.has(w)) continue;
      const mapped = TOKEN_ALIASES[w] ?? w;
      rawCandidates.push(mapped);
    }
  }

  return normalizeTagList(rawCandidates);
}

/** True if a string is usable as a tag after normalization (for tests / guards). */
export function isDerivedTagCandidate(raw: string): boolean {
  return normalizeTagName(raw).length > 0;
}
