/**
 * Tag management for references (API, scripts, admin UI).
 * No `server-only` so CLI scripts can import this module.
 */

import { prisma } from "@/db/client";
import { normalizeTagSetForReference } from "@/domain/tagReferenceNormalization";
import { TagKind } from "@prisma/client";
import { getEnv } from "@/lib/env";
import { normalizeTagName } from "@/domain/tags";
import { upsertTagByName } from "@/services/reference-tags-bulk";

export type TagListItem = {
  name: string;
  referenceCount: number;
};

export type NumericReviewItem = {
  referenceId: string;
  storageKey: string;
  folderPath: string;
  tags: string[];
  numericTags: string[];
  url: string;
};

export function referenceLibraryUrl(referenceId: string, baseUrl?: string): string {
  const base = (baseUrl ?? getEnv().NEXT_PUBLIC_APP_URL).replace(/\/$/, "");
  return `${base}/library/${referenceId}`;
}

export async function listTags(opts: {
  q?: string;
  limit?: number;
  offset?: number;
  kind?: TagKind;
}): Promise<{ items: TagListItem[]; total: number }> {
  const kind = opts.kind ?? TagKind.USER;
  const limit = Math.min(500, Math.max(1, opts.limit ?? 100));
  const offset = Math.max(0, opts.offset ?? 0);
  const q = opts.q?.trim().toLowerCase();

  const where = q ? { name: { contains: q } } : {};

  const [tags, total] = await Promise.all([
    prisma.tag.findMany({
      where,
      orderBy: { name: "asc" },
      take: limit,
      skip: offset,
      select: {
        name: true,
        _count: {
          select: {
            references: { where: { kind } },
          },
        },
      },
    }),
    prisma.tag.count({ where }),
  ]);

  return {
    items: tags.map((t) => ({
      name: t.name,
      referenceCount: t._count.references,
    })),
    total,
  };
}

export async function getReferenceTags(
  referenceId: string,
  kind: TagKind = TagKind.USER,
): Promise<string[]> {
  const rows = await prisma.referenceTag.findMany({
    where: { referenceId, kind },
    select: { tag: { select: { name: true } } },
    orderBy: { tag: { name: "asc" } },
  });
  return rows.map((r) => r.tag.name);
}

export async function setReferenceTags(opts: {
  referenceId: string;
  tagNames: readonly string[];
  kind?: TagKind;
}): Promise<{ ok: true; tags: string[] } | { ok: false; reason: string }> {
  const kind = opts.kind ?? TagKind.USER;
  const ref = await prisma.reference.findUnique({
    where: { id: opts.referenceId },
    select: { id: true },
  });
  if (!ref) return { ok: false, reason: "Reference not found." };

  const { tags } = normalizeTagSetForReference(opts.tagNames);

  await prisma.referenceTag.deleteMany({
    where: { referenceId: opts.referenceId, kind },
  });

  for (const name of tags) {
    const tag = await upsertTagByName(name);
    await prisma.referenceTag.create({
      data: {
        referenceId: opts.referenceId,
        tagId: tag.id,
        kind,
        addedById: null,
      },
    });
  }

  return { ok: true, tags };
}

export async function addReferenceTag(opts: {
  referenceId: string;
  tagName: string;
  kind?: TagKind;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const current = await getReferenceTags(opts.referenceId, opts.kind ?? TagKind.USER);
  const { tags } = normalizeTagSetForReference([...current, opts.tagName]);
  const result = await setReferenceTags({
    referenceId: opts.referenceId,
    tagNames: tags,
    kind: opts.kind,
  });
  if (!result.ok) return result;
  return { ok: true };
}

export async function removeReferenceTag(opts: {
  referenceId: string;
  tagName: string;
  kind?: TagKind;
}): Promise<{ ok: true }> {
  const name = normalizeTagName(opts.tagName);
  if (!name) return { ok: true };
  const kind = opts.kind ?? TagKind.USER;
  const tag = await prisma.tag.findUnique({ where: { name }, select: { id: true } });
  if (!tag) return { ok: true };
  await prisma.referenceTag.deleteMany({
    where: { referenceId: opts.referenceId, tagId: tag.id, kind },
  });
  return { ok: true };
}

async function referenceIdsWithBareNumericUserTags(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT r.id
    FROM "Reference" r
    INNER JOIN "ReferenceTag" rt ON rt."referenceId" = r.id
    INNER JOIN "Tag" t ON t.id = rt."tagId"
    WHERE rt.kind = 'USER' AND t.name ~ '^[0-9]+$'
  `;
  return rows.map((r) => r.id);
}

export async function listNumericReviewQueue(opts: {
  page?: number;
  pageSize?: number;
  baseUrl?: string;
}): Promise<{ items: NumericReviewItem[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
  const allIds = await referenceIdsWithBareNumericUserTags();
  const total = allIds.length;
  const slice = allIds.slice((page - 1) * pageSize, page * pageSize);

  if (slice.length === 0) {
    return { items: [], total, page, pageSize };
  }

  const refs = await prisma.reference.findMany({
    where: { id: { in: slice } },
    select: {
      id: true,
      storageKey: true,
      folderPath: true,
      tags: {
        where: { kind: TagKind.USER },
        select: { tag: { select: { name: true } } },
      },
    },
  });

  const byId = new Map(refs.map((r) => [r.id, r]));
  const items: NumericReviewItem[] = [];

  for (const id of slice) {
    const r = byId.get(id);
    if (!r) continue;
    const tags = r.tags.map((t) => t.tag.name);
    const { needsReview, bareNumericTags } = normalizeTagSetForReference(tags);
    if (!needsReview) continue;
    items.push({
      referenceId: r.id,
      storageKey: r.storageKey,
      folderPath: r.folderPath,
      tags,
      numericTags: bareNumericTags,
      url: referenceLibraryUrl(r.id, opts.baseUrl),
    });
  }

  return { items, total, page, pageSize };
}

export type NormalizeAllStats = {
  referencesScanned: number;
  referencesUpdated: number;
  tagsRemoved: number;
  tagsAdded: number;
  reviewCount: number;
  dryRun: boolean;
};

const NORMALIZE_BATCH_SIZE = 400;

export async function normalizeAllUserTags(opts: {
  dryRun?: boolean;
}): Promise<NormalizeAllStats> {
  const dryRun = opts.dryRun ?? false;

  let referencesScanned = 0;
  let referencesUpdated = 0;
  let tagsRemoved = 0;
  let tagsAdded = 0;
  let reviewCount = 0;

  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.reference.findMany({
      take: NORMALIZE_BATCH_SIZE,
      ...(cursor
        ? { skip: 1, cursor: { id: cursor } }
        : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        tags: {
          where: { kind: TagKind.USER },
          select: { tag: { select: { name: true } } },
        },
      },
    });
    if (batch.length === 0) break;

    for (const ref of batch) {
      referencesScanned += 1;
      const current = ref.tags.map((t) => t.tag.name);
      if (current.length === 0) continue;

      const { tags: next, needsReview } = normalizeTagSetForReference(current);
      if (needsReview) reviewCount += 1;

      const currentSet = new Set(current);
      const nextSet = new Set(next);
      const same =
        currentSet.size === nextSet.size && [...currentSet].every((t) => nextSet.has(t));
      if (same) continue;

      const removed = current.filter((t) => !nextSet.has(t)).length;
      const added = next.filter((t) => !currentSet.has(t)).length;

      if (!dryRun) {
        await setReferenceTags({
          referenceId: ref.id,
          tagNames: next,
          kind: TagKind.USER,
        });
      }

      referencesUpdated += 1;
      tagsRemoved += removed;
      tagsAdded += added;
    }

    cursor = batch[batch.length - 1]?.id;
    if (batch.length < NORMALIZE_BATCH_SIZE) break;
  }

  return {
    referencesScanned,
    referencesUpdated,
    tagsRemoved,
    tagsAdded,
    reviewCount,
    dryRun,
  };
}
