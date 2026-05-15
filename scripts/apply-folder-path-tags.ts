// Load .env.local before Prisma / env (same pattern as ingest-references).
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", override: true });

/**
 * For every distinct `folderPath` in the database, derive tags from the full path
 * and attach them as USER tags to all references in that exact folder.
 *
 * Idempotent: re-running skips duplicates (createMany skipDuplicates).
 *
 * Usage:
 *   npm run tags:from-folders
 *   npm run tags:from-folders -- --dry-run
 */

import { TagKind } from "@prisma/client";
import { prisma } from "../src/db/client";
import { deriveTagsFromFolderPath } from "../src/domain/folderPathTags";
import { bulkTagExactFolder } from "../src/services/reference-tags-bulk";
import { logger } from "../src/lib/logger";

function parseArgs(argv: string[]): { dryRun: boolean } {
  return { dryRun: argv.includes("--dry-run") };
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));

  const rows = await prisma.reference.findMany({
    distinct: ["folderPath"],
    select: { folderPath: true },
    orderBy: { folderPath: "asc" },
  });

  const paths = rows.map((r) => r.folderPath).filter((p) => p.length > 0);
  logger.info({ folderCount: paths.length, dryRun }, "folder paths to process");

  let processed = 0;
  let tagApplied = 0;
  let skipped = 0;

  for (const folderPath of paths) {
    const tags = deriveTagsFromFolderPath(folderPath);
    if (tags.length === 0) {
      skipped += 1;
      continue;
    }
    processed += 1;
    if (dryRun) {
      logger.info({ folderPath, tags }, "[dry-run] would tag");
      tagApplied += tags.length;
      continue;
    }
    const { affected } = await bulkTagExactFolder({
      folderPath,
      tagNames: tags,
      kind: TagKind.USER,
      action: "add",
      addedById: null,
    });
    tagApplied += tags.length;
    if (processed <= 5 || processed % 50 === 0) {
      logger.info({ folderPath, tagCount: tags.length, references: affected }, "tagged folder");
    }
  }

  logger.info({ processed, skipped, distinctFolders: paths.length, dryRun }, "tags:from-folders done");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  logger.error(err, "tags:from-folders fatal");
  await prisma.$disconnect();
  process.exit(1);
});
