/**
 * Prisma bulk operations for reference tags. No `server-only` so scripts (tsx) can import this file.
 */

import { prisma } from "@/db/client";
import { normalizeFolderPath } from "@/domain/folders";
import { normalizeTagList } from "@/domain/tags";
import { TagKind, type Prisma } from "@prisma/client";

export async function upsertTagByName(name: string): Promise<{ id: string }> {
  const tag = await prisma.tag.upsert({
    where: { name },
    update: {},
    create: { name },
    select: { id: true },
  });
  return tag;
}

function folderWhere(folder: string): Prisma.ReferenceWhereInput {
  const norm = normalizeFolderPath(folder);
  if (!norm) return {};
  return {
    OR: [{ folderPath: norm }, { folderPath: { startsWith: `${norm}/` } }],
  };
}

function exactFolderWhere(folderPath: string): Prisma.ReferenceWhereInput {
  const norm = normalizeFolderPath(folderPath);
  return { folderPath: norm };
}

export async function bulkTagExactFolder(opts: {
  folderPath: string;
  tagNames: readonly string[];
  kind: TagKind;
  action: "add" | "remove";
  addedById?: string | null;
}): Promise<{ ok: true; affected: number }> {
  const names = normalizeTagList(opts.tagNames);
  if (names.length === 0) return { ok: true, affected: 0 };

  const references = await prisma.reference.findMany({
    where: exactFolderWhere(opts.folderPath),
    select: { id: true },
  });
  if (references.length === 0) return { ok: true, affected: 0 };

  let tagIds: string[];
  if (opts.action === "add") {
    const tags = await Promise.all(names.map((n) => upsertTagByName(n)));
    tagIds = tags.map((t) => t.id);
  } else {
    const tags = await prisma.tag.findMany({ where: { name: { in: names } }, select: { id: true } });
    tagIds = tags.map((t) => t.id);
  }

  if (tagIds.length === 0) return { ok: true, affected: 0 };

  if (opts.action === "add") {
    const rows = references.flatMap((ref) =>
      tagIds.map((tagId) => ({
        referenceId: ref.id,
        tagId,
        kind: opts.kind,
        addedById: opts.addedById ?? null,
      })),
    );
    await prisma.referenceTag.createMany({ data: rows, skipDuplicates: true });
  } else {
    await prisma.referenceTag.deleteMany({
      where: {
        referenceId: { in: references.map((r) => r.id) },
        tagId: { in: tagIds },
        kind: opts.kind,
      },
    });
  }
  return { ok: true, affected: references.length };
}

export async function bulkTagFolder(opts: {
  folder: string;
  tagNames: readonly string[];
  kind: TagKind;
  action: "add" | "remove";
  addedById?: string | null;
}): Promise<{ ok: true; affected: number }> {
  const names = normalizeTagList(opts.tagNames);
  if (names.length === 0) return { ok: true, affected: 0 };

  const references = await prisma.reference.findMany({
    where: folderWhere(opts.folder),
    select: { id: true },
  });
  if (references.length === 0) return { ok: true, affected: 0 };

  let tagIds: string[];
  if (opts.action === "add") {
    const tags = await Promise.all(names.map((n) => upsertTagByName(n)));
    tagIds = tags.map((t) => t.id);
  } else {
    const tags = await prisma.tag.findMany({ where: { name: { in: names } }, select: { id: true } });
    tagIds = tags.map((t) => t.id);
  }

  if (tagIds.length === 0) return { ok: true, affected: 0 };

  if (opts.action === "add") {
    const rows = references.flatMap((ref) =>
      tagIds.map((tagId) => ({
        referenceId: ref.id,
        tagId,
        kind: opts.kind,
        addedById: opts.addedById ?? null,
      })),
    );
    await prisma.referenceTag.createMany({ data: rows, skipDuplicates: true });
  } else {
    await prisma.referenceTag.deleteMany({
      where: {
        referenceId: { in: references.map((r) => r.id) },
        tagId: { in: tagIds },
        kind: opts.kind,
      },
    });
  }
  return { ok: true, affected: references.length };
}
