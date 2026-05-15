import Link from "next/link";
import { requireAdmin } from "@/auth/guards";
import { prisma } from "@/db/client";
import { getStorage } from "@/storage";
import { TagKind, type Prisma } from "@prisma/client";
import { normalizeFolderPath } from "@/domain/folders";
import { BulkTagBar } from "./BulkTagBar";
import { ReferenceRow, type AdminReferenceRow } from "./ReferenceRow";

interface PageProps {
  searchParams: Promise<{ folder?: string; page?: string }>;
}

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminReferencesPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const folder = normalizeFolderPath(params.folder ?? "");
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const where: Prisma.ReferenceWhereInput = folder
    ? { OR: [{ folderPath: folder }, { folderPath: { startsWith: `${folder}/` } }] }
    : {};

  const [total, rows, folders] = await Promise.all([
    prisma.reference.count({ where }),
    prisma.reference.findMany({
      where,
      orderBy: { folderPath: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { tags: { include: { tag: true } } },
    }),
    prisma.reference.groupBy({
      by: ["folderPath"],
      _count: { _all: true },
      orderBy: { folderPath: "asc" },
    }),
  ]);

  const storage = getStorage();
  const items: AdminReferenceRow[] = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      filename: r.filename,
      title: r.title,
      folderPath: r.folderPath,
      url: await storage.getUrl(r.storageKey),
      userTags: r.tags.filter((t) => t.kind === TagKind.USER).map((t) => t.tag.name),
      adminTags: r.tags.filter((t) => t.kind === TagKind.ADMIN).map((t) => t.tag.name),
    })),
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Folders
        </h2>
        <ul className="space-y-1 text-sm">
          <li>
            <Link href="/admin/references" className="block rounded px-2 py-1 hover:bg-secondary">
              (all)
            </Link>
          </li>
          {folders.map((f) => (
            <li key={f.folderPath || "root"}>
              <Link
                href={{ pathname: "/admin/references", query: { folder: f.folderPath } }}
                className="block rounded px-2 py-1 hover:bg-secondary"
              >
                {f.folderPath || "(root)"} — {f._count._all}
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">References</h1>
          <p className="text-sm text-muted-foreground">
            {total} reference{total === 1 ? "" : "s"}
            {folder ? ` in ${folder}` : ""}
          </p>
        </div>

        <BulkTagBar folder={folder} />

        <div className="rounded-lg border border-border bg-card">
          {items.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">No references.</p>
          ) : (
            <div className="px-4">
              {items.map((r) => (
                <ReferenceRow key={r.id} ref={r} />
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 ? (
          <nav className="flex items-center justify-center gap-2 text-sm">
            {page > 1 ? (
              <Link
                className="rounded border px-3 py-1 hover:bg-secondary"
                href={{ pathname: "/admin/references", query: { folder, page: String(page - 1) } }}
              >
                Previous
              </Link>
            ) : null}
            <span className="text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                className="rounded border px-3 py-1 hover:bg-secondary"
                href={{ pathname: "/admin/references", query: { folder, page: String(page + 1) } }}
              >
                Next
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
