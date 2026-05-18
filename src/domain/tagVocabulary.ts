/**
 * Harmonized tag vocabulary for disk → `tag.txt` pipelines (offline, reproducible).
 *
 * **Synonyms (canonical choice):** footwear — `shoes`, `shoe`, `boot`, `boots` map to
 * `footwear` so search stays one bucket; use other tokens (e.g. path segments like `knee_boots`)
 * for specificity when they survive tokenization as distinct tags.
 */

import { normalizeTagList } from "./tags";

/** Whole-token drops (noise in folder names). */
const DROP_TOKENS = new Set(["pictures", "plus", "view"]);

/** Map lowercased token → canonical replacement (single token → one or more space-separated). */
const TOKEN_ALIASES: Readonly<Record<string, string>> = {
  feets: "feet",
  warriors: "warrior",
  warrior: "warrior",
  mix: "mixed",
  mixed: "mixed",
  shoes: "footwear",
  shoe: "footwear",
  boot: "footwear",
  boots: "footwear",
  wide: "wide angle",
};

/** Strip trailing stray hyphens from a token (e.g. `12-` → `12`). */
export function stripStrayHyphens(token: string): string {
  return token.replace(/-+$/, "").replace(/^-+/, "");
}

function tokenizeForAnalysis(text: string): string[] {
  const lower = text.toLowerCase();
  const parts = lower.split(/[/\\\s._]+/g).filter((p) => p.length > 0);
  const out: string[] = [];
  for (const p of parts) {
    const stripped = stripStrayHyphens(p);
    if (!stripped) continue;
    out.push(stripped);
  }
  return out;
}

/**
 * Map one lowercased, hyphen-stripped token to a display tag string (may contain spaces),
 * or empty string to omit.
 */
export function harmonizeToken(rawToken: string): string {
  const t = stripStrayHyphens(rawToken.toLowerCase());
  if (!t) return "";
  if (DROP_TOKENS.has(t)) return "";
  if (TOKEN_ALIASES[t]) return TOKEN_ALIASES[t];
  return t;
}

/**
 * Build search tags from freeform retrieved text (paths, folder names, file basenames).
 * Offline by default. Optional LLM hook: set `TAG_DEDUCE_USE_LLM=1` and implement
 * a caller that replaces `deduceTagsFromRetrievedText` in `scripts/deduce-tags-from-source.ts`
 * if you need non-rule tagging (not implemented in-repo).
 */
export function deduceTagsFromRetrievedText(text: string): string[] {
  const tokens = tokenizeForAnalysis(text);
  const candidates: string[] = [];
  for (const tok of tokens) {
    const h = harmonizeToken(tok);
    if (h) candidates.push(h);
  }
  return normalizeTagList(candidates);
}
