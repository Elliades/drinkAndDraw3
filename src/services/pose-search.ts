import "server-only";
import { TagKind } from "@prisma/client";
import { prisma } from "@/db/client";
import {
  FEATURE_VECTOR_DIM,
  limbStateToTag,
  maskedCosineSimilarity,
  parseLimbStateKey,
} from "@/features/pose/lib/pose-features";
import { getReferenceById, type ReferenceListItem } from "@/services/references";

export interface PoseSearchResult {
  referenceId: string;
  score: number;
  item?: ReferenceListItem | null;
}

export interface PoseSearchOptions {
  embedding?: number[];
  mask?: number[];
  limbStates?: Record<string, string>;
  folder?: string;
  tags?: string[];
  search?: string;
  limit?: number;
}

interface IndexEntry {
  referenceId: string;
  embedding: Float32Array;
}

let cachedIndex: IndexEntry[] | null = null;
let cacheLoadedAt = 0;

export function invalidatePoseSearchCache(): void {
  cachedIndex = null;
  cacheLoadedAt = 0;
}

async function loadIndex(): Promise<IndexEntry[]> {
  if (cachedIndex) return cachedIndex;

  const rows = await prisma.posePrediction.findMany({
    where: {
      embedding: { isEmpty: false },
    },
    select: {
      referenceId: true,
      embedding: true,
    },
  });

  cachedIndex = rows
    .filter((r) => r.embedding.length === FEATURE_VECTOR_DIM)
    .map((r) => ({
      referenceId: r.referenceId,
      embedding: new Float32Array(r.embedding),
    }));
  cacheLoadedAt = Date.now();
  return cachedIndex;
}

async function filterByLimbStates(
  limbStates: Record<string, string>,
): Promise<Set<string> | null> {
  const entries = Object.entries(limbStates).filter(([, v]) => v);
  if (entries.length === 0) return null;

  const tagNames = entries.map(([key, value]) => {
    const parsed = parseLimbStateKey(key);
    if (!parsed) return value.startsWith("pose:") ? value : null;
    return limbStateToTag(parsed.group, parsed.axis, value);
  }).filter((t): t is string => !!t);

  if (tagNames.length === 0) return null;

  const refs = await prisma.reference.findMany({
    where: {
      isPublic: true,
      isApproved: true,
      AND: tagNames.map((tagName) => ({
        tags: { some: { tag: { name: tagName }, kind: TagKind.POSE } },
      })),
    },
    select: { id: true },
  });

  return new Set(refs.map((r) => r.id));
}

export async function searchByPose(opts: PoseSearchOptions): Promise<PoseSearchResult[]> {
  const limit = Math.min(48, Math.max(1, opts.limit ?? 24));
  const candidateFilter = opts.limbStates
    ? await filterByLimbStates(opts.limbStates)
    : null;

  let candidates = await loadIndex();
  if (candidateFilter) {
    candidates = candidates.filter((c) => candidateFilter.has(c.referenceId));
  }

  if (opts.folder || opts.tags?.length || opts.search) {
    const { listReferences } = await import("@/services/references");
    const filtered = await listReferences({
      folder: opts.folder,
      tags: opts.tags,
      search: opts.search,
      page: 1,
      pageSize: 10_000,
    });
    const allowed = new Set(filtered.items.map((i) => i.id));
    candidates = candidates.filter((c) => allowed.has(c.referenceId));
  }

  if (!opts.embedding || opts.embedding.length !== FEATURE_VECTOR_DIM) {
    const ids = candidates.slice(0, limit).map((c) => c.referenceId);
    const items = await Promise.all(ids.map((id) => getReferenceById(id)));
    return ids.map((id, i) => ({
      referenceId: id,
      score: 1,
      item: items[i],
    }));
  }

  const target = new Float32Array(opts.embedding);
  const mask = opts.mask ? new Float32Array(opts.mask) : undefined;

  const scored = candidates
    .map((c) => ({
      referenceId: c.referenceId,
      score: maskedCosineSimilarity(target, c.embedding, mask),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const items = await Promise.all(
    scored.map((s) => getReferenceById(s.referenceId)),
  );

  return scored.map((s, i) => ({
    ...s,
    item: items[i],
  }));
}

export async function getPoseIndexStats() {
  const index = await loadIndex();
  return { count: index.length, loadedAt: cacheLoadedAt };
}
