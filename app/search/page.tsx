import { searchEverything } from "@/services/search";
import { SearchInput } from "@/ui/search-input";
import { SearchInfiniteSection } from "./SearchInfiniteSection";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q ?? "";
  const result = q
    ? await searchEverything(q)
    : {
        references: { items: [], total: 0, page: 1, pageSize: 24, totalPages: 0 },
        drawings: { items: [], total: 0, page: 1, pageSize: 24, totalPages: 0 },
        users: { items: [], total: 0, page: 1, pageSize: 24, totalPages: 0 },
        total: 0,
      };

  return (
    <main className="container space-y-6 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Search</h1>
        <SearchInput defaultValue={q} />
      </div>

      {q ? (
        <p className="text-sm text-muted-foreground">
          {result.total.toLocaleString()} match{result.total === 1 ? "" : "es"} for{" "}
          <span className="font-semibold">{q}</span>
          {result.total > 0 ? (
            <span>
              {" "}
              (
              {[
                result.references.total > 0
                  ? `${result.references.total.toLocaleString()} references`
                  : null,
                result.drawings.total > 0
                  ? `${result.drawings.total.toLocaleString()} drawings`
                  : null,
                result.users.total > 0
                  ? `${result.users.total.toLocaleString()} users`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              )
            </span>
          ) : null}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Type to search.</p>
      )}

      {q ? (
        <>
          <SearchInfiniteSection
            title="References"
            q={q}
            type="REFERENCE"
            initial={result.references}
            variant="grid"
          />
          <SearchInfiniteSection
            title="Drawings"
            q={q}
            type="DRAWING"
            initial={result.drawings}
            variant="grid"
          />
          <SearchInfiniteSection
            title="Users"
            q={q}
            type="USER"
            initial={result.users}
            variant="users"
          />
        </>
      ) : null}
    </main>
  );
}
