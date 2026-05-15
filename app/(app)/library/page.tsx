import Link from "next/link";
import { Suspense } from "react";
import { FolderOpen, Images } from "lucide-react";
import { listFolders, listReferences, type FolderNode } from "@/services/references";
import { Badge } from "@/ui/badge";
import { Card } from "@/ui/card";

interface PageProps {
  searchParams: Promise<{
    folder?: string;
    tag?: string | string[];
    q?: string;
    page?: string;
  }>;
}

export const dynamic = "force-dynamic";

function getImmediateSubfolders(allFolders: FolderNode[], currentPath?: string): FolderNode[] {
  if (!currentPath) {
    return allFolders.filter((f) => f.path && !f.path.includes("/"));
  }
  const prefix = `${currentPath}/`;
  return allFolders.filter(
    (f) => f.path.startsWith(prefix) && !f.path.slice(prefix.length).includes("/"),
  );
}

export default async function LibraryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tags = params.tag ? (Array.isArray(params.tag) ? params.tag : [params.tag]) : [];
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const [result, folders] = await Promise.all([
    listReferences({ folder: params.folder, tags, search: params.q, page, pageSize: 48 }),
    listFolders(),
  ]);

  const subfolders = getImmediateSubfolders(folders, params.folder);
  const totalCount = folders.reduce((sum, f) => sum + f.count, 0);

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      {/* Sidebar */}
      <aside className="space-y-1">
        <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Folders
        </p>
        <Link
          href="/library"
          className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-secondary ${!params.folder ? "bg-secondary font-semibold text-foreground" : "text-muted-foreground"}`}
        >
          <span className="flex items-center gap-2">
            <Images className="h-3.5 w-3.5 shrink-0" />
            All references
          </span>
          <span className="tabular-nums text-xs">{totalCount}</span>
        </Link>
        {folders.map((f) => {
          const depth = f.path.split("/").length - 1;
          const isActive = params.folder === f.path;
          return (
            <Link
              key={f.path || "root"}
              href={{ pathname: "/library", query: { folder: f.path } }}
              style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
              className={`flex items-center justify-between rounded-lg py-1.5 pr-2 text-sm transition-colors hover:bg-secondary ${isActive ? "bg-secondary font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              <span className="flex items-center gap-2 truncate">
                <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{f.label}</span>
              </span>
              <span className="ml-2 shrink-0 tabular-nums text-xs">{f.count}</span>
            </Link>
          );
        })}
      </aside>

      {/* Main content */}
      <section className="min-w-0 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reference library</h1>
          <p className="text-sm text-muted-foreground">
            {result.total} image{result.total === 1 ? "" : "s"}
            {params.folder ? ` in ${params.folder}` : ""}
            {tags.length > 0 ? ` · tagged ${tags.join(", ")}` : ""}
          </p>
        </div>

        <Suspense fallback={<p>Loading…</p>}>
          {result.items.length === 0 && subfolders.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No references found. Run <code className="rounded bg-muted px-1">npm run ingest</code> to
              populate the library.
            </Card>
          ) : (
            <div className="space-y-8">
              {/* Subfolder cards */}
              {subfolders.length > 0 && (
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Subfolders
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {subfolders.map((folder) => (
                      <Link
                        key={folder.path}
                        href={{ pathname: "/library", query: { folder: folder.path } }}
                        className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-primary/10">
                          <FolderOpen className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                        </div>
                        <div>
                          <p className="line-clamp-1 text-sm font-semibold">{folder.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {folder.count} image{folder.count === 1 ? "" : "s"}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Masonry image grid */}
              {result.items.length > 0 && (
                <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5 [column-fill:_balance]">
                  {result.items.map((ref) => (
                    <Link
                      key={ref.id}
                      href={{ pathname: `/library/${ref.id}` }}
                      className="group mb-3 block break-inside-avoid overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                    >
                      <div className="overflow-hidden bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={ref.url}
                          alt={ref.title ?? ref.filename}
                          className="block h-auto w-full transition-transform duration-300 group-hover:scale-[1.03]"
                          style={
                            ref.width && ref.height
                              ? { aspectRatio: `${ref.width}/${ref.height}` }
                              : undefined
                          }
                          loading="lazy"
                        />
                      </div>
                      <div className="p-2.5">
                        <p className="line-clamp-1 text-xs font-medium">
                          {ref.title ?? ref.filename}
                        </p>
                        {ref.tags.length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {ref.tags.slice(0, 2).map((t) => (
                              <Badge key={t} className="px-1.5 py-0 text-[10px]">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </Suspense>

        {result.totalPages > 1 ? (
          <Pagination page={result.page} totalPages={result.totalPages} searchParams={params} />
        ) : null}
      </section>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const buildHref = (p: number) => {
    const query: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined) query[k] = v;
    }
    query.page = String(p);
    return { pathname: "/library" as const, query };
  };
  return (
    <nav className="flex items-center justify-center gap-2 text-sm">
      {page > 1 ? <Link className="rounded border px-3 py-1 hover:bg-secondary" href={buildHref(page - 1)}>Previous</Link> : null}
      <span className="text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? <Link className="rounded border px-3 py-1 hover:bg-secondary" href={buildHref(page + 1)}>Next</Link> : null}
    </nav>
  );
}
