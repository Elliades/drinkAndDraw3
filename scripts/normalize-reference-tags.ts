// Load .env.local before Prisma / getEnv.
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", override: true });

/**
 * Apply per-reference tag normalization rules to all USER tags in the database.
 *
 * Usage:
 *   npm run tags:normalize
 *   npm run tags:normalize -- --dry-run
 */

import { prisma } from "../src/db/client";
import { logger } from "../src/lib/logger";
import { normalizeAllUserTags } from "../src/services/tag-management";

function parseArgs(argv: string[]): { dryRun: boolean } {
  let dryRun = false;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
  }
  return { dryRun };
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  logger.info({ dryRun }, "normalize-reference-tags: start");
  const stats = await normalizeAllUserTags({ dryRun });
  logger.info(stats, "normalize-reference-tags: done");
  if (stats.reviewCount > 0) {
    logger.info(
      { reviewCount: stats.reviewCount },
      "references with bare numeric tags remain — see /admin/tags/review or GET /api/tags/v1/review/numeric",
    );
  }
}

main()
  .catch(async (err) => {
    logger.error(err, "normalize-reference-tags fatal");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
