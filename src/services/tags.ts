import "server-only";
import { prisma } from "@/db/client";
import { normalizeTagName } from "@/domain/tags";

export interface TagWithCount {
  name: string;
  referenceCount: number;
  drawingCount: number;
}

export async function listPoseTags(opts: { limit?: number } = {}): Promise<TagWithCount[]> {
  const limit = opts.limit ?? 100;
  const rows = await prisma.tag.findMany({
    where: { name: { startsWith: "pose:" } },
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

export async function listTags(opts: { limit?: number; excludePose?: boolean } = {}): Promise<TagWithCount[]> {
  const limit = opts.limit ?? 200;
  const rows = await prisma.tag.findMany({
    where: opts.excludePose ? { NOT: { name: { startsWith: "pose:" } } } : undefined,
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
