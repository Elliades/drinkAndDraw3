// Load .env.local before Prisma / getEnv.
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", override: true });

/**
 * Emit a JSON manifest of references that still need a precomputed 3D pose mesh,
 * for the offline tool at tools/pose3d/export_glb.py.
 *
 * Each entry is { id, url } (S3) or { id, image } (local absolute path), which
 * export_glb.py downloads/reads. Only references without pose data are included
 * (poseDataKey null AND poseStatus null), so reruns naturally backfill new ones.
 *
 * Usage:
 *   npm run pose3d:manifest -- --out tools/pose3d/in.json
 *   npm run pose3d:manifest -- --out tools/pose3d/in.json --all      # include every reference
 *   npm run pose3d:manifest -- --out tools/pose3d/in.json --retry-failed
 *   npm run pose3d:manifest -- --out tools/pose3d/in.json --limit 50
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/db/client";
import { logger } from "../src/lib/logger";
import { getStorage } from "../src/storage/create-storage";
import { getEnv } from "../src/lib/env";

interface Args {
  out: string;
  all: boolean;
  retryFailed: boolean;
  limit?: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { out: "tools/pose3d/in.json", all: false, retryFailed: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") args.out = argv[++i] ?? args.out;
    else if (a === "--all") args.all = true;
    else if (a === "--retry-failed") args.retryFailed = true;
    else if (a === "--limit") args.limit = Number(argv[++i]);
  }
  return args;
}

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = getEnv();
  const storage = getStorage();

  const where: Prisma.ReferenceWhereInput = args.all
    ? {}
    : {
        poseDataKey: null,
        ...(args.retryFailed ? {} : { poseStatus: null }),
      };

  const rows = await prisma.reference.findMany({
    where,
    select: { id: true, storageKey: true },
    orderBy: { createdAt: "desc" },
    ...(args.limit ? { take: args.limit } : {}),
  });

  logger.info({ count: rows.length, all: args.all }, "pose3d:manifest start");

  const items: Array<{ id: string; url?: string; image?: string }> = [];
  for (const r of rows) {
    if (storage.name === "local") {
      // Same machine: hand the GPU tool a direct file path (no dev server needed).
      const absDir = path.isAbsolute(env.LOCAL_IMAGE_DIR)
        ? env.LOCAL_IMAGE_DIR
        : path.resolve(process.cwd(), env.LOCAL_IMAGE_DIR);
      items.push({ id: r.id, image: path.resolve(absDir, r.storageKey) });
    } else {
      items.push({
        id: r.id,
        url: await storage.getUrl(r.storageKey, { expiresInSeconds: SEVEN_DAYS_SECONDS }),
      });
    }
  }

  const outPath = path.resolve(process.cwd(), args.out);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(items, null, 2), "utf-8");

  logger.info({ outPath, count: items.length, driver: storage.name }, "pose3d:manifest done");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  logger.error(err, "pose3d:manifest fatal");
  await prisma.$disconnect();
  process.exit(1);
});
