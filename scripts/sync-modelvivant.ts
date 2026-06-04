// Load .env.local before Prisma / getEnv (same pattern as ingest-references).
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", override: true });

/**
 * Full ModelVivant library sync:
 *  1. Walk `--root` (default MODEL_VIVANT_DIR / F:\ModelVivant), upsert Reference rows.
 *  2. Delete DB references under those albums whose files are gone (deleted / moved).
 *  3. Reset USER tags from every `tag.txt` under the tree (deepest folder wins per reference).
 *
 * Usage:
 *   npm run sync:modelvivant
 *   npm run sync:modelvivant -- --dry-run
 *   npm run sync:modelvivant -- --root "D:\\Other\\ModelVivant"
 *   npm run sync:modelvivant -- --skip-tags
 *
 * Ensure `LOCAL_IMAGE_DIR` in `.env.local` points at the same folder so `/api/files` serves them.
 */

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { normalizeFolderPath } from "../src/domain/folders";
import {
  filenameFromKey,
  folderPathFromKey,
  titleFromFilename,
} from "../src/domain/storage-keys";
import { prisma } from "../src/db/client";
import { logger } from "../src/lib/logger";
import { LocalStorageProvider } from "../src/storage/local";
import type { StorageObject } from "../src/storage/types";
import { ensureThumbForStorageKey, deleteThumb } from "../src/media/thumbnails";
import { pruneStaleReferencesUnderScope, scopeWhereUnderTopLevelFolders } from "./lib/reference-prune";
import { runSyncReferenceTagsFromTagfiles } from "./sync-reference-tags-from-tagfiles";

function parseArgs(argv: string[]): { dryRun: boolean; root: string; skipTags: boolean } {
  let dryRun = false;
  let skipTags = false;
  let root = process.env.MODEL_VIVANT_DIR?.trim() || "F:\\ModelVivant";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--skip-tags") skipTags = true;
    else if (a === "--root") root = argv[++i] ?? root;
  }
  return { dryRun, root: path.resolve(root), skipTags };
}

async function listTopLevelFolderNames(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => normalizeFolderPath(e.name)).filter(Boolean);
}

async function dimensionsFromPath(filePath: string): Promise<{ width?: number; height?: number }> {
  try {
    const meta = await sharp(filePath).metadata();
    return { width: meta.width, height: meta.height };
  } catch (err) {
    logger.warn({ err }, "sharp metadata failed");
    return {};
  }
}

async function ingestOne(
  obj: StorageObject,
  rootDir: string,
  dryRun: boolean,
): Promise<"created" | "updated" | "unchanged" | "failed"> {
  const filename = filenameFromKey(obj.key);
  const folderPath = folderPathFromKey(obj.key);
  const title = titleFromFilename(filename);

  let dims: { width?: number; height?: number } = {};
  if (!dryRun) {
    try {
      const absPath = path.join(rootDir, obj.key.replace(/\//g, path.sep));
      dims = await dimensionsFromPath(absPath);
    } catch (err) {
      logger.warn({ err, key: obj.key }, "could not read dimensions");
    }
  }

  const data = {
    storageKey: obj.key,
    filename,
    title,
    folderPath,
    mimeType: obj.contentType ?? "image/jpeg",
    fileSizeBytes: obj.size ?? null,
    source: "local" as const,
    ...(dims.width ? { width: dims.width } : {}),
    ...(dims.height ? { height: dims.height } : {}),
  };

  if (dryRun) {
    return "unchanged";
  }

  try {
    const existing = await prisma.reference.findUnique({ where: { storageKey: obj.key } });
    if (!existing) {
      await prisma.reference.create({ data });
      await ensureThumbForStorageKey(obj.key);
      return "created";
    }
    const same =
      existing.filename === data.filename &&
      existing.folderPath === data.folderPath &&
      existing.fileSizeBytes === data.fileSizeBytes &&
      existing.width === (data.width ?? existing.width) &&
      existing.height === (data.height ?? existing.height);
    if (same) {
      await ensureThumbForStorageKey(obj.key);
      return "unchanged";
    }
    await prisma.reference.update({ where: { id: existing.id }, data });
    await ensureThumbForStorageKey(obj.key, { force: true });
    return "updated";
  } catch (err) {
    logger.error({ err, key: obj.key }, "upsert failed");
    return "failed";
  }
}

async function main() {
  const { dryRun, root, skipTags } = parseArgs(process.argv.slice(2));

  let rootStat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    rootStat = await fs.stat(root);
  } catch (err) {
    logger.error({ err, root }, "ModelVivant root does not exist or is not readable");
    process.exit(1);
    return;
  }
  if (!rootStat.isDirectory()) {
    logger.error({ root }, "ModelVivant root is not a directory");
    process.exit(1);
    return;
  }

  const storage = new LocalStorageProvider(root);
  logger.info({ root, dryRun, skipTags }, "sync-modelvivant: ingest start");

  const objects = await storage.list();
  const diskKeys = new Set(objects.map((o) => o.key));
  logger.info({ count: objects.length }, "found image files on disk");

  const ingestStats = { created: 0, updated: 0, unchanged: 0, failed: 0, total: objects.length };
  let processed = 0;
  for (const obj of objects) {
    const outcome = await ingestOne(obj, root, dryRun);
    ingestStats[outcome] += 1;
    processed += 1;
    if (processed % 200 === 0) {
      logger.info({ processed, total: ingestStats.total }, "ingest progress");
    }
  }
  logger.info(ingestStats, "sync-modelvivant: ingest done");

  const topLevel = await listTopLevelFolderNames(root);
  const scope = scopeWhereUnderTopLevelFolders(topLevel);
  const pruneResult = await pruneStaleReferencesUnderScope({ diskKeys, scope, dryRun });
  logger.info(pruneResult, "sync-modelvivant: prune done");
  if (!dryRun) {
    for (const key of pruneResult.staleStorageKeys) {
      await deleteThumb(key);
    }
  }

  if (skipTags) {
    logger.info("sync-modelvivant: --skip-tags, skipping tag sync");
    await prisma.$disconnect();
    return;
  }

  if (dryRun) {
    logger.info({ root }, "sync-modelvivant: [dry-run] would run tags:from-disk");
    await prisma.$disconnect();
    return;
  }

  logger.info({ root }, "sync-modelvivant: syncing USER tags from tag.txt");
  await runSyncReferenceTagsFromTagfiles({ root, dryRun: false });
  logger.info("sync-modelvivant: complete");
}

main().catch(async (err) => {
  logger.error(err, "sync-modelvivant fatal");
  await prisma.$disconnect();
  process.exit(1);
});
