import "server-only";
import { createHash } from "node:crypto";
import { Prisma, TagKind } from "@prisma/client";
import { prisma } from "@/db/client";
import { getStorage } from "@/storage";
import { normalizeFolderPath } from "@/domain/folders";
import { normalizeTagList } from "@/domain/tags";

export interface ReferenceListFilters {
  folder?: string;
  tags?: readonly string[];
  search?: string;
  page?: number;
  pageSize?: number;
  /** When `"random"`, `randomSeed` controls a stable shuffle for pagination. */
  sort?: "recent" | "random";
  randomSeed?: string;
}

export interface ReferenceListItem {
  id: string;
  title: string | null;
  filename: string;
  folderPath: string;
  url: string;
  width: number | null;
  height: number | null;
  tags: string[];
  userTags: string[];
  adminTags: string[];
}

export interface ReferenceListResult {
  items: ReferenceListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

function buildWhere(filters: ReferenceListFilters): Prisma.ReferenceWhereInput {
  const where: Prisma.ReferenceWhereInput = {
    isPublic: true,
    isApproved: true,
  };

  if (filters.folder !== undefined) {
    const norm = normalizeFolderPath(filters.folder);
    if (norm) {
      where.OR = [{ folderPath: norm }, { folderPath: { startsWith: `${norm}/` } }];
    }
  }

  const tags = normalizeTagList(filters.tags ?? []);
  if (tags.length > 0) {
    where.AND = tags.map((tagName) => ({
      tags: { some: { tag: { name: tagName } } },
    }));
  }

  if (filters.search && filters.search.trim().length > 0) {
    const q = filters.search.trim();
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { filename: { contains: q, mode: "insensitive" } },
          { folderPath: { contains: q, mode: "insensitive" } },
          { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
        ],
      },
    ];
  }

  return where;
}

async function attachUrls(
  rows: Array<{
    id: string;
    title: string | null;
    filename: string;
    folderPath: string;
    storageKey: string;
    width: number | null;
    height: number | null;
    tags: Array<{ kind: TagKind; tag: { name: string } }>;
  }>,
): Promise<ReferenceListItem[]> {
  const storage = getStorage();
  return Promise.all(
    rows.map(async (r) => {
      const userTags = r.tags.filter((t) => t.kind === TagKind.USER).map((t) => t.tag.name);
      const adminTags = r.tags.filter((t) => t.kind === TagKind.ADMIN).map((t) => t.tag.name);
      return {
        id: r.id,
        title: r.title,
        filename: r.filename,
        folderPath: r.folderPath,
        url: await storage.getUrl(r.storageKey),
        width: r.width,
        height: r.height,
        tags: r.tags.map((t) => t.tag.name),
        userTags,
        adminTags,
      };
    }),
  );
}

function md5SortKey(id: string, seed: string): string {
  return createHash("md5").update(id + seed).digest("hex");
}

/**
 * Deterministic random order (same seed → same order) so pagination is stable.
 * Loads matching ids into memory; acceptable for typical library sizes.
 */
async function listReferencesRandomOrder(
  filters: ReferenceListFilters,
): Promise<ReferenceListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const seed = filters.randomSeed ?? "0";
  const where = buildWhere(filters);

  const [total, idRows] = await Promise.all([
    prisma.reference.count({ where }),
    prisma.reference.findMany({ where, select: { id: true } }),
  ]);

  const sortedIds = idRows
    .map((r) => r.id)
    .sort((a, b) => md5SortKey(a, seed).localeCompare(md5SortKey(b, seed)));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const slice = sortedIds.slice((page - 1) * pageSize, page * pageSize);

  if (slice.length === 0) {
    return {
      items: [],
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  const rows = await prisma.reference.findMany({
    where: { id: { in: slice } },
    include: { tags: { include: { tag: true } } },
  });
  const order = new Map(slice.map((id, i) => [id, i]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return {
    items: await attachUrls(rows),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function listReferences(filters: ReferenceListFilters): Promise<ReferenceListResult> {
  if (filters.sort === "random") {
    return listReferencesRandomOrder(filters);
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const where = buildWhere(filters);

  const [total, rows] = await Promise.all([
    prisma.reference.count({ where }),
    prisma.reference.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { tags: { include: { tag: true } } },
    }),
  ]);

  return {
    items: await attachUrls(rows),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getReferenceById(id: string): Promise<ReferenceListItem | null> {
  const row = await prisma.reference.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } },
  });
  if (!row) return null;
  const [first] = await attachUrls([row]);
  return first ?? null;
}

export async function getRandomReference(
  tags?: readonly string[],
): Promise<ReferenceListItem | null> {
  const where = buildWhere({ tags });
  const count = await prisma.reference.count({ where });
  if (count === 0) return null;
  const skip = Math.floor(Math.random() * count);
  const row = await prisma.reference.findFirst({
    where,
    skip,
    include: { tags: { include: { tag: true } } },
  });
  if (!row) return null;
  const [first] = await attachUrls([row]);
  return first ?? null;
}

export interface FolderNode {
  path: string;
  label: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Home feed sections
// ---------------------------------------------------------------------------

export interface HomeSection {
  id: string;
  /** Display title for the marquee row */
  title: string;
  /** Optional second line under the title (e.g. date context) */
  subtitle?: string;
  /** Link for a "View all →" action, if applicable */
  href?: string;
  items: ReferenceListItem[];
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out.slice(0, n);
}

const HOME_RANDOM_PICKS = 24;
const HOME_NEW_REFS_LIMIT = 24;

function startOfUtcCalendarDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcCalendarDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0));
}

function formatUtcMediumDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(d);
}

async function loadReferencesByIdsInOrder(ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await prisma.reference.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      title: true,
      filename: true,
      folderPath: true,
      storageKey: true,
      width: true,
      height: true,
      tags: { include: { tag: true } },
    },
  });
  const order = new Map(ids.map((id, i) => [id, i]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return rows;
}

/** Random public approved references (uniform over the library, PostgreSQL `random()`). */
async function fetchRandomPublicReferencesForHome(limit: number) {
  const idRows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM "Reference" WHERE "isPublic" = ${true} AND "isApproved" = ${true} ORDER BY random() LIMIT ${limit}`,
  );
  const ids = idRows.map((r) => r.id);
  return loadReferencesByIdsInOrder(ids);
}

/** Random public approved references created or updated within a UTC calendar day. */
async function fetchRandomPublicReferencesForUtcDay(dayStart: Date, dayEnd: Date, limit: number) {
  const idRows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT id FROM "Reference"
      WHERE "isPublic" = ${true} AND "isApproved" = ${true}
      AND (
        ("createdAt" >= ${dayStart} AND "createdAt" < ${dayEnd})
        OR ("updatedAt" >= ${dayStart} AND "updatedAt" < ${dayEnd})
      )
      ORDER BY random()
      LIMIT ${limit}
    `,
  );
  const ids = idRows.map((r) => r.id);
  return loadReferencesByIdsInOrder(ids);
}

/** Random public approved references created or updated since `since` (inclusive). */
async function fetchRandomPublicReferencesSince(since: Date, limit: number) {
  const idRows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT id FROM "Reference"
      WHERE "isPublic" = ${true} AND "isApproved" = ${true}
      AND ("createdAt" >= ${since} OR "updatedAt" >= ${since})
      ORDER BY random()
      LIMIT ${limit}
    `,
  );
  const ids = idRows.map((r) => r.id);
  return loadReferencesByIdsInOrder(ids);
}

/**
 * Builds the home-page sections:
 *  0. "New references" — random picks from references created or updated today (UTC); falls back to the last 14 days
 *  1. "Loved by the community" — sorted by number of favorites
 *  2. Up to `folderCount` randomly-chosen folders (each named after the folder)
 *  3. "Random picks" — random rows from the whole public library
 */
export async function getHomeSections(
  opts: { folderCount?: number } = {},
): Promise<HomeSection[]> {
  const { folderCount = 3 } = opts;

  const now = new Date();
  const utcDayStart = startOfUtcCalendarDay(now);
  const utcDayEnd = endOfUtcCalendarDay(now);
  const recentSince = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const dayLabel = formatUtcMediumDate(utcDayStart);

  // 1. Pick random eligible folders
  const allFolders = await listFolders();
  const eligible = allFolders.filter((f) => f.path && f.count >= 6);
  const pickedFolders = pickRandom(eligible, folderCount);

  // 2. Parallel data fetch
  const [favGroups, randomRefs, newRefsToday, newRefsRecent, ...folderRows] = await Promise.all([
    // Top-favorited reference IDs
    prisma.favorite.groupBy({
      by: ["targetId"],
      where: { targetType: "REFERENCE" },
      _count: { targetId: true },
      orderBy: { _count: { targetId: "desc" } },
      take: 24,
    }),
    fetchRandomPublicReferencesForHome(HOME_RANDOM_PICKS),
    fetchRandomPublicReferencesForUtcDay(utcDayStart, utcDayEnd, HOME_NEW_REFS_LIMIT),
    fetchRandomPublicReferencesSince(recentSince, HOME_NEW_REFS_LIMIT),
    // One query per folder
    ...pickedFolders.map((f) =>
      prisma.reference.findMany({
        where: {
          isPublic: true,
          isApproved: true,
          OR: [{ folderPath: f.path }, { folderPath: { startsWith: `${f.path}/` } }],
        },
        orderBy: { createdAt: "desc" },
        take: 24,
        select: {
          id: true, title: true, filename: true, folderPath: true,
          storageKey: true, width: true, height: true,
          tags: { include: { tag: true } },
        },
      }),
    ),
  ]);

  // 3. Resolve favorited references
  const favIds = favGroups.map((g) => g.targetId);
  let favRefs: typeof randomRefs = [];
  if (favIds.length > 0) {
    favRefs = await prisma.reference.findMany({
      where: { id: { in: favIds }, isPublic: true, isApproved: true },
      select: {
        id: true, title: true, filename: true, folderPath: true,
        storageKey: true, width: true, height: true,
        tags: { include: { tag: true } },
      },
    });
    const order = new Map(favIds.map((id, i) => [id, i]));
    favRefs.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
  } else {
    // Fallback to most-viewed when no favorites exist yet
    favRefs = await prisma.reference.findMany({
      where: { isPublic: true, isApproved: true },
      orderBy: { viewsCount: "desc" },
      take: 24,
      select: {
        id: true, title: true, filename: true, folderPath: true,
        storageKey: true, width: true, height: true,
        tags: { include: { tag: true } },
      },
    });
  }

  const newRefsSource = newRefsToday.length > 0 ? newRefsToday : newRefsRecent;
  const newRefsSubtitle =
    newRefsToday.length > 0
      ? `Random picks from references added or updated on ${dayLabel} (UTC).`
      : `Nothing was added or updated today (${dayLabel}, UTC). Here is a random sample from the last 14 days.`;

  // 4. Attach storage URLs to all groups in parallel
  const [favItems, randomItems, newRefItems, ...folderItems] = await Promise.all([
    attachUrls(favRefs),
    attachUrls(randomRefs),
    attachUrls(newRefsSource),
    ...folderRows.map((rows) => attachUrls(rows)),
  ]);

  // 5. Assemble sections — interleave folders between fixed sections
  const sections: HomeSection[] = [];

  if (newRefItems.length > 0) {
    sections.push({
      id: "new-references",
      title: "New references",
      subtitle: newRefsSubtitle,
      href: "/library",
      items: newRefItems,
    });
  }

  if (favItems.length > 0) {
    sections.push({
      id: "favorites",
      title: "Loved by the community",
      href: "/library",
      items: favItems,
    });
  }

  pickedFolders.forEach((folder, i) => {
    const items = folderItems[i] ?? [];
    if (items.length > 0) {
      sections.push({
        id: `folder-${folder.path}`,
        title: folder.label,
        href: `/library?folder=${encodeURIComponent(folder.path)}`,
        items,
      });
    }
  });

  if (randomItems.length > 0) {
    const randomSeed = `${Math.floor(Math.random() * 1_000_000_000)}`;
    sections.push({
      id: "random",
      title: "Random picks",
      href: `/library?sort=random&seed=${encodeURIComponent(randomSeed)}`,
      items: randomItems,
    });
  }

  return sections;
}

export async function listFolders(): Promise<FolderNode[]> {
  const rows = await prisma.reference.groupBy({
    by: ["folderPath"],
    _count: { _all: true },
    where: { isPublic: true, isApproved: true },
    orderBy: { folderPath: "asc" },
  });
  return rows.map((r) => {
    const fp = r.folderPath ?? "";
    const label = fp ? fp.split("/").slice(-1)[0]! : "(root)";
    return { path: fp, label, count: r._count._all };
  });
}
