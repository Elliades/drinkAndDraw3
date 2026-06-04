import "server-only";
import { prisma } from "@/db/client";
import { thumbPublicUrlFromStorageKey } from "@/media/thumbnails";
import { getStorage } from "@/storage";
import { TargetType } from "@prisma/client";

export interface SearchHit {
  type: "REFERENCE" | "DRAWING" | "USER";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  imageUrl?: string;
  /** Grid thumbnail for references (full imageUrl kept for drawings). */
  thumbnailUrl?: string;
}

export interface SearchResult {
  references: SearchHit[];
  drawings: SearchHit[];
  users: SearchHit[];
  total: number;
}

const PER_TYPE_LIMIT = 24;

export async function searchEverything(query: string): Promise<SearchResult> {
  const q = query.trim();
  if (!q) return { references: [], drawings: [], users: [], total: 0 };

  const [references, drawings, users] = await Promise.all([
    prisma.reference.findMany({
      where: {
        isPublic: true,
        isApproved: true,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { filename: { contains: q, mode: "insensitive" } },
          { folderPath: { contains: q, mode: "insensitive" } },
          { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: PER_TYPE_LIMIT,
      select: { id: true, title: true, filename: true, folderPath: true, storageKey: true },
    }),
    prisma.drawing.findMany({
      where: {
        isPublic: true,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { filename: { contains: q, mode: "insensitive" } },
          { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: PER_TYPE_LIMIT,
      select: {
        id: true,
        title: true,
        filename: true,
        storageKey: true,
        owner: { select: { handle: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        OR: [
          { handle: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      take: PER_TYPE_LIMIT,
      select: { id: true, handle: true, name: true, image: true },
    }),
  ]);

  const storage = getStorage();
  const refHits: SearchHit[] = await Promise.all(
    references.map(async (r) => ({
      type: "REFERENCE" as const,
      id: r.id,
      title: r.title ?? r.filename,
      subtitle: r.folderPath || "(root)",
      href: `/library/${r.id}`,
      imageUrl: await storage.getUrl(r.storageKey),
      thumbnailUrl: thumbPublicUrlFromStorageKey(r.storageKey),
    })),
  );
  const drawingHits: SearchHit[] = await Promise.all(
    drawings.map(async (d) => ({
      type: "DRAWING" as const,
      id: d.id,
      title: d.title ?? d.filename,
      subtitle: d.owner.handle ? `@${d.owner.handle}` : (d.owner.name ?? ""),
      href: `/drawings/${d.id}`,
      imageUrl: await storage.getUrl(d.storageKey),
    })),
  );
  const userHits: SearchHit[] = users.map((u) => ({
    type: "USER" as const,
    id: u.id,
    title: u.handle ? `@${u.handle}` : (u.name ?? "(no handle)"),
    subtitle: u.name ?? "",
    href: u.handle ? `/u/${u.handle}` : "/",
    imageUrl: u.image ?? undefined,
  }));

  return {
    references: refHits,
    drawings: drawingHits,
    users: userHits,
    total: refHits.length + drawingHits.length + userHits.length,
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
