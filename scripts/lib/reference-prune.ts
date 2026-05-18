/**
 * Remove Reference rows that no longer exist on disk (deleted / moved without re-key).
 * Scoped to folder trees so other LOCAL_IMAGE_DIR content is untouched.
 */

import type { Prisma } from "@prisma/client";
import { normalizeFolderPath } from "../../src/domain/folders";
import { prisma } from "../../src/db/client";
import { logger } from "../../src/lib/logger";

/** OR filter: references under any of the top-level album folder names. */
export function scopeWhereUnderTopLevelFolders(topLevelFolderNames: readonly string[]): Prisma.ReferenceWhereInput {
  const names = topLevelFolderNames.map((n) => normalizeFolderPath(n)).filter(Boolean);
  if (names.length === 0) return { id: { in: [] } };
  return {
    OR: names.flatMap((name) => [
      { folderPath: name },
      { folderPath: { startsWith: `${name}/` } },
      { storageKey: { startsWith: `${name}/` } },
    ]),
  };
}

export async function pruneStaleReferencesUnderScope(opts: {
  diskKeys: ReadonlySet<string>;
  scope: Prisma.ReferenceWhereInput;
  dryRun: boolean;
}): Promise<{ scanned: number; deleted: number }> {
  const refs = await prisma.reference.findMany({
    where: opts.scope,
    select: { id: true, storageKey: true, folderPath: true },
  });

  const stale = refs.filter((r) => !opts.diskKeys.has(r.storageKey));
  if (stale.length === 0) {
    return { scanned: refs.length, deleted: 0 };
  }

  if (opts.dryRun) {
    logger.info(
      { scanned: refs.length, wouldDelete: stale.length, sample: stale.slice(0, 5).map((r) => r.storageKey) },
      "[dry-run] would prune stale references",
    );
    return { scanned: refs.length, deleted: stale.length };
  }

  const ids = stale.map((r) => r.id);
  const BATCH = 500;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    const res = await prisma.reference.deleteMany({ where: { id: { in: slice } } });
    deleted += res.count;
  }

  logger.info({ scanned: refs.length, deleted, staleSample: stale.slice(0, 5).map((r) => r.storageKey) }, "pruned stale references");
  return { scanned: refs.length, deleted };
}
