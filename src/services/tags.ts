import "server-only";
import { prisma } from "@/db/client";
import { normalizeTagName } from "@/domain/tags";

export interface TagWithCount {
  name: string;
  referenceCount: number;
  drawingCount: number;
}

export async function listTags(opts: { limit?: number } = {}): Promise<TagWithCount[]> {
  const limit = opts.limit ?? 200;
  const rows = await prisma.tag.findMany({
    take: limit,
    orderBy: { name: "asc" },
    select: {
      name: true,
      _count: { select: { references: true, drawings: true } },
    },
  });
  return rows.map((r) => ({
    name: r.name,
    referenceCount: r._count.references,
    drawingCount: r._count.drawings,
  }));
}

export async function searchTags(query: string, limit = 20): Promise<TagWithCount[]> {
  const norm = normalizeTagName(query);
  if (!norm) return listTags({ limit });
  const rows = await prisma.tag.findMany({
    where: { name: { contains: norm, mode: "insensitive" } },
    take: limit,
    orderBy: { name: "asc" },
    select: {
      name: true,
      _count: { select: { references: true, drawings: true } },
    },
  });
  return rows.map((r) => ({
    name: r.name,
    referenceCount: r._count.references,
    drawingCount: r._count.drawings,
  }));
}
