// Load .env.local before Prisma (same pattern as ingest-references).
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", override: true });

/**
 * Clears all USER tags on every Reference, then attaches tags from disk:
 * finds every `tag.txt` under the ModelVivant root recursively. Each file tags
 * references whose `folderPath` is that folder **or a descendant**, but when
 * several `tag.txt` paths apply, **only the deepest matching folder** on the
 * chain wins (longest `folderPath` key that is a prefix of the reference folder).
 *
 * ADMIN reference tags are left unchanged.
 *
 * Usage:
 *   npm run tags:from-disk
 *   npm run tags:from-disk -- --dry-run
 *   npm run tags:from-disk -- --root "D:/other/ModelVivant"
 *
 * Default root: `MODEL_VIVANT_DIR` env, else `F:\\ModelVivant` on Windows.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TagKind } from "@prisma/client";
import { normalizeFolderPath } from "../src/domain/folders";
import { normalizeTagSetForReference } from "../src/domain/tagReferenceNormalization";
import { normalizeTagList } from "../src/domain/tags";
import { prisma } from "../src/db/client";
import { logger } from "../src/lib/logger";

const TAG_NAME_BATCH = 2000;

async function ensureTagIdsByNames(names: ReadonlySet<string>): Promise<Map<string, string>> {
  const list = [...names];
  if (list.length === 0) return new Map();

  const byName = new Map<string, string>();

  for (let off = 0; off < list.length; off += TAG_NAME_BATCH) {
    const slice = list.slice(off, off + TAG_NAME_BATCH);
    const existing = await prisma.tag.findMany({
      where: { name: { in: slice } },
      select: { id: true, name: true },
    });
    for (const t of existing) {
      byName.set(t.name, t.id);
    }
  }

  const missing = list.filter((n) => !byName.has(n));
  if (missing.length > 0) {
    for (let off = 0; off < missing.length; off += TAG_NAME_BATCH) {
      const slice = missing.slice(off, off + TAG_NAME_BATCH);
      await prisma.tag.createMany({
        data: slice.map((name) => ({ name })),
        skipDuplicates: true,
      });
    }
    for (let off = 0; off < missing.length; off += TAG_NAME_BATCH) {
      const slice = missing.slice(off, off + TAG_NAME_BATCH);
      const created = await prisma.tag.findMany({
        where: { name: { in: slice } },
        select: { id: true, name: true },
      });
      for (const t of created) {
        byName.set(t.name, t.id);
      }
    }
  }

  return byName;
}

const DEFAULT_ROOT =
  process.platform === "win32" ? "F:\\ModelVivant" : path.join(path.sep, "ModelVivant");

export function parseArgs(argv: string[]): { dryRun: boolean; root: string } {
  let dryRun = false;
  let root = process.env.MODEL_VIVANT_DIR?.trim() || DEFAULT_ROOT;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--root") root = argv[++i] ?? root;
  }
  return { dryRun, root: path.resolve(root) };
}

/** Recursively find each directory that contains `tag.txt` → map folderPath → tag names. */
export async function readTagFileMapRecursive(rootDir: string): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();

  async function walk(absDir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch (err) {
      logger.error({ err, absDir }, "cannot read directory while scanning tag.txt");
      return;
    }

    for (const ent of entries) {
      if (ent.isDirectory()) {
        await walk(path.join(absDir, ent.name));
      }
    }

    const tagPath = path.join(absDir, "tag.txt");
    try {
      const st = await fs.stat(tagPath);
      if (!st.isFile()) return;
    } catch {
      return;
    }

    const rel = path.relative(rootDir, absDir);
    const key = normalizeFolderPath(rel.split(path.sep).join("/"));
    let raw: string;
    try {
      raw = await fs.readFile(tagPath, "utf8");
    } catch (err) {
      logger.warn({ err, tagPath }, "cannot read tag.txt");
      return;
    }
    const names = normalizeTagList(raw.split(/\n/));
    if (names.length === 0) return;
    map.set(key, names);
  }

  try {
    await fs.access(rootDir);
  } catch (err) {
    logger.error({ err, rootDir }, "cannot access ModelVivant root");
    throw err;
  }

  await walk(rootDir);
  return map;
}

/**
 * Longest matching `tag.txt` folder on the reference path (walk prefixes of `folderPath`).
 */
export function deepestTagsForReferenceFolder(
  referenceFolderPath: string,
  tagByFolder: ReadonlyMap<string, readonly string[]>,
): readonly string[] {
  const norm = normalizeFolderPath(referenceFolderPath);
  const parts = norm ? norm.split("/").filter(Boolean) : [];
  for (let i = parts.length; i >= 0; i--) {
    const key = i === 0 ? "" : parts.slice(0, i).join("/");
    const t = tagByFolder.get(key);
    if (t && t.length > 0) return t;
  }
  return [];
}

const CREATE_MANY_CHUNK = 20_000;

export type SyncTagFilesStats = {
  tagTxtFolders: number;
  deletedUserTagRows: number;
  referenceRows: number;
  userTagRowsCreated: number;
  referencesTagged: number;
};

export async function runSyncReferenceTagsFromTagfiles(opts: {
  root: string;
  dryRun: boolean;
}): Promise<SyncTagFilesStats> {
  const { root, dryRun } = opts;
  const albumTags = await readTagFileMapRecursive(root);

  logger.info(
    { root, tagTxtFolders: albumTags.size, dryRun },
    "sync-reference-tags-from-tagfiles: loaded tag.txt folders",
  );

  const userTagCount = await prisma.referenceTag.count({ where: { kind: TagKind.USER } });
  const refs = await prisma.reference.findMany({ select: { id: true, folderPath: true } });
  const refCount = refs.length;

  if (dryRun) {
    let wouldTagRefs = 0;
    let wouldRows = 0;
    const sample = new Map<string, number>();
    for (const r of refs) {
      const rawTags = deepestTagsForReferenceFolder(r.folderPath ?? "", albumTags);
      const { tags } = normalizeTagSetForReference(rawTags);
      if (tags.length === 0) continue;
      wouldTagRefs += 1;
      wouldRows += tags.length;
      if (sample.size < 8) sample.set(r.folderPath ?? "(root)", tags.length);
    }
    logger.info(
      {
        userTagCount,
        refCount,
        tagTxtFolders: albumTags.size,
        wouldTagRefs,
        wouldAttachRows: wouldRows,
        sampleFolders: Object.fromEntries(sample),
      },
      "[dry-run] no DB writes",
    );
    await prisma.$disconnect();
    return {
      tagTxtFolders: albumTags.size,
      deletedUserTagRows: 0,
      referenceRows: refCount,
      userTagRowsCreated: 0,
      referencesTagged: wouldTagRefs,
    };
  }

  const deleted = await prisma.referenceTag.deleteMany({ where: { kind: TagKind.USER } });
  logger.info({ deleted: deleted.count, previousUserTagRows: userTagCount }, "removed USER ReferenceTag rows");

  const allNames = new Set<string>();
  for (const names of albumTags.values()) {
    for (const n of names) allNames.add(n);
  }

  const tagNameToId = await ensureTagIdsByNames(allNames);
  logger.info({ uniqueTagNames: allNames.size }, "resolved Tag rows for disk sync");

  type Row = { referenceId: string; tagId: string; kind: typeof TagKind.USER; addedById: null };
  let referencesTagged = 0;
  let userTagRowsCreated = 0;
  let pending: Row[] = [];

  const flush = async () => {
    if (pending.length === 0) return;
    await prisma.referenceTag.createMany({ data: pending, skipDuplicates: true });
    userTagRowsCreated += pending.length;
    pending = [];
  };

  for (const r of refs) {
    const rawTags = deepestTagsForReferenceFolder(r.folderPath ?? "", albumTags);
    const { tags } = normalizeTagSetForReference(rawTags);
    if (tags.length === 0) continue;
    referencesTagged += 1;
    for (const tagName of tags) {
      const tagId = tagNameToId.get(tagName);
      if (!tagId) continue;
      pending.push({
        referenceId: r.id,
        tagId,
        kind: TagKind.USER,
        addedById: null,
      });
      if (pending.length >= CREATE_MANY_CHUNK) {
        await flush();
      }
    }
  }
  await flush();

  const newUserTagCount = await prisma.referenceTag.count({ where: { kind: TagKind.USER } });
  logger.info(
    {
      tagTxtFolders: albumTags.size,
      newUserTagCount,
      referencesTotal: refCount,
      referencesTagged,
      userTagRowsCreated,
    },
    "sync-reference-tags-from-tagfiles done",
  );
  await prisma.$disconnect();

  return {
    tagTxtFolders: albumTags.size,
    deletedUserTagRows: deleted.count,
    referenceRows: refCount,
    userTagRowsCreated,
    referencesTagged,
  };
}

async function main() {
  const { dryRun, root } = parseArgs(process.argv.slice(2));
  await runSyncReferenceTagsFromTagfiles({ root, dryRun });
}

const isRunDirectly =
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");
if (isRunDirectly) {
  main().catch(async (err) => {
    logger.error(err, "sync-reference-tags-from-tagfiles fatal");
    await prisma.$disconnect();
    process.exit(1);
  });
}
