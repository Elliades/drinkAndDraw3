/**
 * Tag normalization rules.
 *
 * Canonical tag form: lowercase, trimmed, internal whitespace collapsed to single spaces,
 * stripped of leading/trailing punctuation, max length 64.
 *
 * Duplicates removed in `normalizeTagList`. Empty results filtered out.
 */

const MAX_TAG_LENGTH = 64;

export function normalizeTagName(raw: string): string {
  if (typeof raw !== "string") return "";
  const collapsed = raw
    .toLowerCase()
    .replace(/[\s_]+/g, " ")
    .trim()
    .replace(/^[-_.\s]+|[-_.\s]+$/g, "");
  if (!collapsed) return "";
  return collapsed.slice(0, MAX_TAG_LENGTH);
}

export function normalizeTagList(raws: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of raws) {
    const n = normalizeTagName(raw);
    if (!n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function isValidTagName(raw: string): boolean {
  return normalizeTagName(raw).length > 0;
}
