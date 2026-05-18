// Load .env.local before any other imports so getEnv() sees the right values.
// override:true ensures shell-injected defaults don't mask the file's values.
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", override: true });

/**
 * Ingest references from the active storage backend into the database.
 *
 *  - Walks the configured StorageProvider (local FS or S3).
 *  - For each image, derives folderPath from the key, reads dimensions via sharp,
 *    and upserts a Reference row keyed by storageKey.
 *  - Idempotent: re-running picks up new files; existing rows are updated only if
 *    metadata changed.
 *
 * Usage:
 *   npm run ingest                # ingest from STORAGE_DRIVER
 *   npm run ingest -- --dry-run   # log only, no DB writes
 *   npm run ingest -- --prefix Hands  # only files under that key prefix
 *   npm run ingest -- --prune         # delete DB rows whose storageKey is missing on disk (full list only)
 *
 * After ingesting (or when folder names change), derive folder-based tags for search:
 *   npm run tags:from-folders
 */

import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/db/client";
import { getStorage } from "../src/storage/create-storage";
import { LocalStorageProvider } from "../src/storage/local";
import type { StorageObject } from "../src/storage/types";
import {
  filenameFromKey,
  folderPathFromKey,
  titleFromFilename,
} from "../src/domain/storage-keys";
import { logger } from "../src/lib/logger";
import { getEnv } from "../src/lib/env";
import { pruneStaleReferencesUnderScope } from "./lib/reference-prune";

interface CliOptions {
  dryRun: boolean;
  prefix?: string;
  prune: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { dryRun: false, prune: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--prefix") opts.prefix = argv[++i];
    else if (arg === "--prune") opts.prune = true;
  }
  return opts;
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

interface IngestResult {
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  total: number;
}

async function ingestOne(
  obj: StorageObject,
  storage: ReturnType<typeof getStorage>,
  dryRun: boolean,
): Promise<"created" | "updated" | "unchanged" | "failed"> {
  const filename = filenameFromKey(obj.key);
  const folderPath = folderPathFromKey(obj.key);
  const title = titleFromFilename(filename);

  let dims: { width?: number; height?: number } = {};
  if (!dryRun) {
    try {
      if (storage instanceof LocalStorageProvider) {
        const env = getEnv();
        const rootDir = path.isAbsolute(env.LOCAL_IMAGE_DIR)
          ? env.LOCAL_IMAGE_DIR
          : path.resolve(process.cwd(), env.LOCAL_IMAGE_DIR);
        const absPath = path.join(rootDir, obj.key.replace(/\//g, path.sep));
        dims = await dimensionsFromPath(absPath);
      } else {
        const head = await storage.head(obj.key);
        if (head && head.size && head.size < 50 * 1024 * 1024) {
          const obj2 = await storage.read(obj.key);
          const meta = await sharp(obj2.body).metadata();
          dims = { width: meta.width, height: meta.height };
        }
      }
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
    source: storage.name,
    ...(dims.width ? { width: dims.width } : {}),
    ...(dims.height ? { height: dims.height } : {}),
  };

  if (dryRun) {
    logger.info({ key: obj.key, folderPath, title }, "[dry] would upsert");
    return "unchanged";
  }

  try {
    const existing = await prisma.reference.findUnique({ where: { storageKey: obj.key } });
    if (!existing) {
      await prisma.reference.create({ data });
      return "created";
    }
    const same =
      existing.filename === data.filename &&
      existing.folderPath === data.folderPath &&
      existing.fileSizeBytes === data.fileSizeBytes &&
      existing.width === (data.width ?? existing.width) &&
      existing.height === (data.height ?? existing.height);
    if (same) return "unchanged";
    await prisma.reference.update({ where: { id: existing.id }, data });
    return "updated";
  } catch (err) {
    logger.error({ err, key: obj.key }, "upsert failed");
    return "failed";
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const storage = getStorage();
  logger.info({ driver: storage.name, opts }, "ingest start");

  const objects = await storage.list(opts.prefix);
  logger.info({ count: objects.length }, "found objects");

  const result: IngestResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    total: objects.length,
  };

  let processed = 0;
  for (const obj of objects) {
    const outcome = await ingestOne(obj, storage, opts.dryRun);
    result[outcome] += 1;
    processed += 1;
    if (processed % 50 === 0) {
      logger.info({ processed, total: result.total }, "progress");
    }
  }

  logger.info(result, "ingest done");

  if (opts.prune && !opts.prefix) {
    const diskKeys = new Set(objects.map((o) => o.key));
    const pruneResult = await pruneStaleReferencesUnderScope({
      diskKeys,
      scope: {},
      dryRun: opts.dryRun,
    });
    logger.info(pruneResult, "ingest prune done");
  } else if (opts.prune && opts.prefix) {
    logger.warn("--prune ignored when --prefix is set (run a full ingest to prune safely)");
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  logger.error(err, "ingest fatal");
  await prisma.$disconnect();
  process.exit(1);
});
