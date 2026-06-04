// Load .env.local before Prisma / getEnv.
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", override: true });

/**
 * Pre-generate thumbnails for all references in the database.
 * Skips thumbs that are already up to date (see ensureThumbForStorageKey).
 *
 * Usage:
 *   npm run thumbs:backfill
 *   npm run thumbs:backfill -- --force
 */

import { prisma } from "../src/db/client";
import { logger } from "../src/lib/logger";
import { ensureThumbForStorageKey } from "../src/media/thumbnails";

function parseArgs(argv: string[]): { force: boolean } {
  let force = false;
  for (const a of argv) {
    if (a === "--force") force = true;
  }
  return { force };
}

async function main() {
  const { force } = parseArgs(process.argv.slice(2));
  const refs = await prisma.reference.findMany({
    select: { storageKey: true },
    orderBy: { storageKey: "asc" },
  });
  logger.info({ count: refs.length, force }, "thumbs:backfill start");

  let written = 0;
  let skipped = 0;
  let failed = 0;
  for (let i = 0; i < refs.length; i++) {
    const { storageKey } = refs[i]!;
    try {
      const did = await ensureThumbForStorageKey(storageKey, { force });
      if (did) written += 1;
      else skipped += 1;
    } catch (err) {
      failed += 1;
      logger.warn({ err, storageKey }, "thumb backfill failed");
    }
    if ((i + 1) % 200 === 0) {
      logger.info({ processed: i + 1, total: refs.length, written, skipped, failed }, "progress");
    }
  }

  logger.info({ total: refs.length, written, skipped, failed }, "thumbs:backfill done");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  logger.error(err, "thumbs:backfill fatal");
  await prisma.$disconnect();
  process.exit(1);
});
