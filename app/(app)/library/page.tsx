import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FolderOpen, Images } from "lucide-react";
import { listFolders, listReferences, type FolderNode } from "@/services/references";
import { Card } from "@/ui/card";
import { LibraryInfiniteGrid } from "./LibraryInfiniteGrid";

interface PageProps {
  searchParams: Promise<{
    folder?: string;
    tag?: string | string[];
    q?: string;
    page?: string;
    sort?: string;
    seed?: string;
  }>;
}

export const dynamic = "force-dynamic";

function buildLibraryQueryString(params: {
  folder?: string;
  tag?: string | string[];
  q?: string;
  sort?: string;
  seed?: string;
}): string {
  const sp = new URLSearchParams();
  if (params.folder) sp.set("folder", params.folder);
  if (params.q) sp.set("q", params.q);
  const tags = params.tag ? (Array.isArray(params.tag) ? params.tag : [params.tag]) : [];
  for (const t of tags) sp.append("tag", t);
  if (params.sort === "random") sp.set("sort", "random");
  if (params.seed !== undefined) sp.set("seed", params.seed);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

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
  const sortRandom = params.sort === "random";

  if (params.page && params.page !== "1") {
    const { page: _page, ...rest } = params;
    redirect(`/library${buildLibraryQueryString(rest)}`);
  }

  if (sortRandom && params.seed === undefined) {
    const seed = `${Math.floor(Math.random() * 1_000_000_000)}`;
    redirect(`/library${buildLibraryQueryString({ ...params, sort: "random", seed })}`);
  }

  const [result, folders] = await Promise.all([
    listReferences({
      folder: params.folder,
      tags,
      search: params.q,
      page: 1,
      pageSize: 48,
      sort: sortRandom ? "random" : "recent",
      randomSeed: params.seed,
    }),
    listFolders(),
  ]);

  const subfolders = sortRandom ? [] : getImmediateSubfolders(folders, params.folder);
  const totalCount = folders.reduce((sum, f) => sum + f.count, 0);
  const gridKey = [params.folder ?? "", params.q ?? "", tags.join(","), sortRandom ? params.seed : "recent"].join("|");

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
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

      <section className="min-w-0 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reference library</h1>
          <p className="text-sm text-muted-foreground">
            {sortRandom ? (
              <>
                Random picks — {result.total} image{result.total === 1 ? "" : "s"}
                {params.folder ? ` in ${params.folder}` : ""}
                {tags.length > 0 ? ` · tagged ${tags.join(", ")}` : ""}
              </>
            ) : (
              <>
                {result.total} image{result.total === 1 ? "" : "s"}
                {params.folder ? ` in ${params.folder}` : ""}
                {tags.length > 0 ? ` · tagged ${tags.join(", ")}` : ""}
              </>
            )}
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

              {result.items.length > 0 ? (
                <LibraryInfiniteGrid
                  key={gridKey}
                  initialItems={result.items}
                  initialPage={result.page}
                  totalPages={result.totalPages}
                  filters={{
                    folder: params.folder,
                    tags,
                    q: params.q,
                    sort: sortRandom ? "random" : "recent",
                    seed: params.seed,
                  }}
                />
              ) : null}
            </div>
          )}
        </Suspense>
      </section>
    </div>
  );
}


