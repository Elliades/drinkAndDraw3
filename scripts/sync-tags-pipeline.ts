/**
 * Orchestration: Phase 1 retrieve → Phase 2 deduce → `npm run tags:from-disk` (DB sync).
 *
 * Usage:
 *   npm run tags:pipeline
 *   npm run tags:pipeline -- --dry-run
 *   npm run tags:pipeline -- --root "F:/ModelVivant" -- --dry-run
 *
 * A second `--` splits pipeline flags (`--root`, `--out`, `--in`) from sync-only flags
 * (`--dry-run`, etc.). If you omit the second `--`, unknown flags are passed to sync.
 */

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", override: true });

import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../src/lib/logger";
import { runDeduce } from "./deduce-tags-from-source";
import { runRetrieve } from "./retrieve-tag-source";
import { parseArgs as parseSyncArgs, runSyncReferenceTagsFromTagfiles } from "./sync-reference-tags-from-tagfiles";

const repoRoot = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));

function splitForwardArgs(argv: string[]): { early: string[]; syncExtra: string[] } {
  const double = argv.indexOf("--");
  if (double >= 0) {
    return { early: argv.slice(0, double), syncExtra: argv.slice(double + 1) };
  }
  const early: string[] = [];
  const syncExtra: string[] = [];
  for (let i = 0; i < argv.length; ) {
    const a = argv[i];
    if (a === undefined) break;
    if (a === "--root" || a === "--out" || a === "--in") {
      early.push(a, argv[i + 1] ?? "");
      i += 2;
      continue;
    }
    syncExtra.push(a);
    i += 1;
  }
  return { early, syncExtra };
}

function parsePipelineArgs(argv: string[]): {
  root: string;
  out: string;
  sourceJsonl: string;
  syncExtra: string[];
} {
  const { early, syncExtra } = splitForwardArgs(argv);
  let root =
    process.env.MODEL_VIVANT_DIR?.trim() ||
    (process.platform === "win32" ? "F:\\ModelVivant" : path.join(path.sep, "ModelVivant"));
  let out = path.join(repoRoot, "scripts", ".cache", "tag-source.jsonl");
  let sourceJsonl = out;
  for (let i = 0; i < early.length; i++) {
    const a = early[i];
    if (a === "--root") root = early[++i] ?? root;
    else if (a === "--out") out = early[++i] ?? out;
    else if (a === "--in") sourceJsonl = early[++i] ?? sourceJsonl;
  }
  return {
    root: path.resolve(root),
    out: path.resolve(out),
    sourceJsonl: path.resolve(sourceJsonl),
    syncExtra,
  };
}

async function main() {
  const { root, out, sourceJsonl, syncExtra } = parsePipelineArgs(process.argv.slice(2));
  logger.info({ root, out, sourceJsonl }, "tags pipeline: retrieve");
  await runRetrieve({ root, out });
  logger.info({ root, sourceJsonl }, "tags pipeline: deduce");
  await runDeduce({ root, sourceJsonl });
  const syncArgv = ["--root", root, ...syncExtra];
  const { dryRun } = parseSyncArgs(syncArgv);
  logger.info({ root, dryRun }, "tags pipeline: sync DB");
  process.env.MODEL_VIVANT_DIR = root;
  await runSyncReferenceTagsFromTagfiles({ root, dryRun });
}

const isRunDirectly =
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");
if (isRunDirectly) {
  main().catch((err) => {
    logger.error(err, "sync-tags-pipeline fatal");
    process.exit(1);
  });
}
