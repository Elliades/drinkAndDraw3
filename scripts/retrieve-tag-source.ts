/**
 * Phase 1 — collect textual context per **leaf** folder under MODEL_VIVANT_DIR (recursive).
 * A leaf has no subdirectories (files and/or empty only). Writes JSON Lines to
 * `scripts/.cache/tag-source.jsonl` (not committed; cache dir gitignored).
 *
 * Usage:
 *   npm run tags:retrieve
 *   npm run tags:retrieve -- --root "F:/ModelVivant"
 *   npm run tags:retrieve -- --out scripts/.cache/tag-source.jsonl
 */

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", override: true });

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeFolderPath } from "../src/domain/folders";
import { logger } from "../src/lib/logger";

export type TagSourceRecord = {
  /** Relative folder path from ModelVivant root (forward slashes). */
  relPath: string;
  leafFolderName: string;
  parentSegments: string[];
  fileBasenames: string[];
};

const DEFAULT_ROOT =
  process.platform === "win32" ? "F:\\ModelVivant" : path.join(path.sep, "ModelVivant");

function defaultOutPath(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), ".cache", "tag-source.jsonl");
}

function parseArgs(argv: string[]): { root: string; out: string } {
  let root = process.env.MODEL_VIVANT_DIR?.trim() || DEFAULT_ROOT;
  let out = defaultOutPath();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") root = argv[++i] ?? root;
    else if (a === "--out") out = argv[++i] ?? out;
  }
  return { root: path.resolve(root), out: path.resolve(out) };
}

async function isLeafDirectory(absDir: string): Promise<boolean> {
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  return !entries.some((e) => e.isDirectory());
}

/** DFS: collect absolute paths of leaf directories. */
async function collectLeafDirs(absRoot: string): Promise<string[]> {
  const leaves: string[] = [];

  async function visit(absDir: string): Promise<void> {
    if (await isLeafDirectory(absDir)) {
      leaves.push(absDir);
      return;
    }
    const entries = await fs.readdir(absDir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      await visit(path.join(absDir, ent.name));
    }
  }

  await visit(absRoot);
  return leaves;
}

async function listFileBasenames(absDir: string): Promise<string[]> {
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  return entries.filter((e) => e.isFile()).map((e) => e.name);
}

export async function buildTagSourceRecord(rootResolved: string, leafAbs: string): Promise<TagSourceRecord> {
  const relRaw = path.relative(rootResolved, leafAbs);
  const relPath = normalizeFolderPath(relRaw.split(path.sep).join("/"));
  const leafFolderName = path.basename(leafAbs);
  const parentRaw = path.dirname(relRaw);
  const parentSegments =
    parentRaw && parentRaw !== "."
      ? normalizeFolderPath(parentRaw.split(path.sep).join("/"))
          .split("/")
          .filter(Boolean)
      : [];
  const fileBasenames = await listFileBasenames(leafAbs);
  return { relPath, leafFolderName, parentSegments, fileBasenames };
}

export async function runRetrieve(opts: { root: string; out: string }): Promise<{
  leaves: number;
  out: string;
}> {
  const { root, out } = opts;
  await fs.mkdir(path.dirname(out), { recursive: true });

  let leaves: string[];
  try {
    leaves = await collectLeafDirs(root);
  } catch (err) {
    logger.error({ err, root }, "retrieve-tag-source: cannot walk root");
    throw err;
  }

  const lines: string[] = [];
  let failed = 0;
  for (const leafAbs of leaves) {
    try {
      const rec = await buildTagSourceRecord(root, leafAbs);
      lines.push(JSON.stringify(rec));
    } catch (err) {
      failed += 1;
      logger.warn({ err, leafAbs }, "retrieve-tag-source: skip leaf");
    }
  }

  await fs.writeFile(out, lines.join("\n") + (lines.length ? "\n" : ""), "utf8");
  logger.info({ root, leaves: leaves.length, written: lines.length, failed, out }, "retrieve-tag-source done");
  return { leaves: lines.length, out };
}

async function main() {
  const { root, out } = parseArgs(process.argv.slice(2));
  await runRetrieve({ root, out });
}

const isRunDirectly =
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");
if (isRunDirectly) void main();
