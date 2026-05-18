/**
 * Phase 2 — read Phase 1 JSONL, harmonize tags, write `tag.txt` in each leaf folder (overwrite).
 *
 * Usage:
 *   npm run tags:deduce
 *   npm run tags:deduce -- --root "F:/ModelVivant" --in scripts/.cache/tag-source.jsonl
 */

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", override: true });

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deduceTagsFromRetrievedText } from "../src/domain/tagVocabulary";
import { logger } from "../src/lib/logger";

const DEFAULT_ROOT =
  process.platform === "win32" ? "F:\\ModelVivant" : path.join(path.sep, "ModelVivant");

function defaultInPath(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), ".cache", "tag-source.jsonl");
}

function parseArgs(argv: string[]): { root: string; sourceJsonl: string } {
  let root = process.env.MODEL_VIVANT_DIR?.trim() || DEFAULT_ROOT;
  let sourceJsonl = defaultInPath();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") root = argv[++i] ?? root;
    else if (a === "--in") sourceJsonl = argv[++i] ?? sourceJsonl;
  }
  return { root: path.resolve(root), sourceJsonl: path.resolve(sourceJsonl) };
}

/** Default off: every image basename inflates tag.txt and DB sync to millions of rows. */
function includeFileBasenamesInDeduce(): boolean {
  return process.env.TAG_INCLUDE_FILE_BASENAMES === "1";
}

export function retrievedTextFromRecord(rec: {
  relPath: string;
  leafFolderName: string;
  parentSegments: string[];
  fileBasenames: string[];
}): string {
  const parts = [rec.relPath.replace(/\//g, " "), rec.leafFolderName, ...rec.parentSegments];
  if (includeFileBasenamesInDeduce()) {
    parts.push(...rec.fileBasenames.map((b) => path.parse(b).name));
  }
  return parts.join(" ");
}

export async function runDeduce(opts: { root: string; sourceJsonl: string }): Promise<{
  recordsRead: number;
  tagFilesWritten: number;
  skipped: number;
  failures: string[];
}> {
  const { root, sourceJsonl } = opts;
  let raw: string;
  try {
    raw = await fs.readFile(sourceJsonl, "utf8");
  } catch (err) {
    logger.error({ err, sourceJsonl }, "deduce-tags: missing source JSONL; run tags:retrieve first");
    throw err;
  }

  const failures: string[] = [];
  let recordsRead = 0;
  let tagFilesWritten = 0;
  let skipped = 0;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    recordsRead += 1;
    let rec: {
      relPath: string;
      leafFolderName: string;
      parentSegments: string[];
      fileBasenames: string[];
    };
    try {
      rec = JSON.parse(trimmed) as typeof rec;
    } catch {
      failures.push(`invalid JSON line`);
      continue;
    }

    const text = retrievedTextFromRecord(rec);
    const finalTags = deduceTagsFromRetrievedText(text);
    if (finalTags.length === 0) {
      skipped += 1;
    }

    const folderAbs = path.join(root, ...rec.relPath.split("/").filter(Boolean));
    const tagPath = path.join(folderAbs, "tag.txt");
    try {
      await fs.mkdir(folderAbs, { recursive: true });
      await fs.writeFile(tagPath, finalTags.join("\n") + (finalTags.length ? "\n" : ""), "utf8");
      tagFilesWritten += 1;
    } catch (err) {
      failures.push(rec.relPath || folderAbs);
      logger.warn({ err, tagPath }, "deduce-tags: failed to write tag.txt");
    }
  }

  logger.info(
    { root, recordsRead, tagFilesWritten, skipped, failures: failures.length, sourceJsonl },
    "deduce-tags-from-source done",
  );
  return { recordsRead, tagFilesWritten, skipped, failures };
}

async function main() {
  const { root, sourceJsonl } = parseArgs(process.argv.slice(2));
  await runDeduce({ root, sourceJsonl });
}

const isRunDirectly =
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");
if (isRunDirectly) void main();
