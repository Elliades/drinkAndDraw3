import "server-only";
import { prisma } from "@/db/client";
import { thumbPublicUrlFromStorageKey } from "@/media/thumbnails";
import { getStorage } from "@/storage";
import { TargetType, type Prisma } from "@prisma/client";

export type SearchHitType = "REFERENCE" | "DRAWING" | "USER";

export interface SearchHit {
  type: SearchHitType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  imageUrl?: string;
  /** Grid thumbnail for references (full imageUrl kept for drawings). */
  thumbnailUrl?: string;
}

export interface SearchTypePage {
  items: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SearchResult {
  references: SearchTypePage;
  drawings: SearchTypePage;
  users: SearchTypePage;
  total: number;
}

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

function clampPage(page: number): number {
  return Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);
}

function clampPageSize(pageSize: number): number {
  if (!Number.isFinite(pageSize)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize)));
}

function referenceWhere(q: string): Prisma.ReferenceWhereInput {
  return {
    isPublic: true,
    isApproved: true,
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { filename: { contains: q, mode: "insensitive" } },
      { folderPath: { contains: q, mode: "insensitive" } },
      { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
    ],
  };
}

function drawingWhere(q: string): Prisma.DrawingWhereInput {
  return {
    isPublic: true,
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { filename: { contains: q, mode: "insensitive" } },
      { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
    ],
  };
}

function userWhere(q: string): Prisma.UserWhereInput {
  return {
    OR: [
      { handle: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ],
  };
}

async function mapReferenceHits(
  rows: Array<{
    id: string;
    title: string | null;
    filename: string;
    folderPath: string;
    storageKey: string;
  }>,
): Promise<SearchHit[]> {
  const storage = getStorage();
  return Promise.all(
    rows.map(async (r) => ({
      type: "REFERENCE" as const,
      id: r.id,
      title: r.title ?? r.filename,
      subtitle: r.folderPath || "(root)",
      href: `/library/${r.id}`,
      imageUrl: await storage.getUrl(r.storageKey),
      thumbnailUrl: thumbPublicUrlFromStorageKey(r.storageKey),
    })),
  );
}

async function mapDrawingHits(
  rows: Array<{
    id: string;
    title: string | null;
    filename: string;
    storageKey: string;
    owner: { handle: string | null; name: string | null };
  }>,
): Promise<SearchHit[]> {
  const storage = getStorage();
  return Promise.all(
    rows.map(async (d) => ({
      type: "DRAWING" as const,
      id: d.id,
      title: d.title ?? d.filename,
      subtitle: d.owner.handle ? `@${d.owner.handle}` : (d.owner.name ?? ""),
      href: `/drawings/${d.id}`,
      imageUrl: await storage.getUrl(d.storageKey),
    })),
  );
}

function mapUserHits(
  rows: Array<{
    id: string;
    handle: string | null;
    name: string | null;
    image: string | null;
  }>,
): SearchHit[] {
  return rows.map((u) => ({
    type: "USER" as const,
    id: u.id,
    title: u.handle ? `@${u.handle}` : (u.name ?? "(no handle)"),
    subtitle: u.name ?? "",
    href: u.handle ? `/u/${u.handle}` : "/",
    imageUrl: u.image ?? undefined,
  }));
}

function emptyPage(page: number, pageSize: number): SearchTypePage {
  return { items: [], total: 0, page, pageSize, totalPages: 0 };
}

export async function searchByType(
  query: string,
  type: SearchHitType,
  opts: { page?: number; pageSize?: number } = {},
): Promise<SearchTypePage> {
  const q = query.trim();
  const page = clampPage(opts.page ?? 1);
  const pageSize = clampPageSize(opts.pageSize ?? DEFAULT_PAGE_SIZE);
  if (!q) return emptyPage(page, pageSize);

  const skip = (page - 1) * pageSize;

  if (type === "REFERENCE") {
    const where = referenceWhere(q);
    const [total, rows] = await Promise.all([
      prisma.reference.count({ where }),
      prisma.reference.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: { id: true, title: true, filename: true, folderPath: true, storageKey: true },
      }),
    ]);
    return {
      items: await mapReferenceHits(rows),
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  if (type === "DRAWING") {
    const where = drawingWhere(q);
    const [total, rows] = await Promise.all([
      prisma.drawing.count({ where }),
      prisma.drawing.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          filename: true,
          storageKey: true,
          owner: { select: { handle: true, name: true } },
        },
      }),
    ]);
    return {
      items: await mapDrawingHits(rows),
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  const where = userWhere(q);
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      select: { id: true, handle: true, name: true, image: true },
    }),
  ]);
  return {
    items: mapUserHits(rows),
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export async function searchEverything(
  query: string,
  opts: { pageSize?: number } = {},
): Promise<SearchResult> {
  const q = query.trim();
  const pageSize = clampPageSize(opts.pageSize ?? DEFAULT_PAGE_SIZE);
  if (!q) {
    return {
      references: emptyPage(1, pageSize),
      drawings: emptyPage(1, pageSize),
      users: emptyPage(1, pageSize),
      total: 0,
    };
  }

  const [references, drawings, users] = await Promise.all([
    searchByType(q, "REFERENCE", { page: 1, pageSize }),
    searchByType(q, "DRAWING", { page: 1, pageSize }),
    searchByType(q, "USER", { page: 1, pageSize }),
  ]);

  return {
    references,
    drawings,
    users,
    total: references.total + drawings.total + users.total,
  };
}

export interface FeedItem {
  kind: TargetType;
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  href: string;
  createdAt: Date;
}

export async function getExploreFeed(opts: { limit?: number } = {}): Promise<FeedItem[]> {
  const limit = opts.limit ?? 60;
  const half = Math.ceil(limit / 2);
  const [refs, draws] = await Promise.all([
    prisma.reference.findMany({
      where: { isPublic: true, isApproved: true },
      orderBy: { createdAt: "desc" },
      take: half,
      select: { id: true, title: true, filename: true, folderPath: true, storageKey: true, createdAt: true },
    }),
    prisma.drawing.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: "desc" },
      take: half,
      select: {
        id: true,
        title: true,
        filename: true,
        storageKey: true,
        createdAt: true,
        owner: { select: { handle: true, name: true } },
      },
    }),
  ]);

  const storage = getStorage();
  const refItems: FeedItem[] = await Promise.all(
    refs.map(async (r) => ({
      kind: TargetType.REFERENCE,
      id: r.id,
      title: r.title ?? r.filename,
      subtitle: r.folderPath || "(root)",
      imageUrl: await storage.getUrl(r.storageKey),
      href: `/library/${r.id}`,
      createdAt: r.createdAt,
    })),
  );
  const drawingItems: FeedItem[] = await Promise.all(
    draws.map(async (d) => ({
      kind: TargetType.DRAWING,
      id: d.id,
      title: d.title ?? d.filename,
      subtitle: d.owner.handle ? `@${d.owner.handle}` : (d.owner.name ?? ""),
      imageUrl: await storage.getUrl(d.storageKey),
      href: `/drawings/${d.id}`,
      createdAt: d.createdAt,
    })),
  );

  return [...refItems, ...drawingItems].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}
