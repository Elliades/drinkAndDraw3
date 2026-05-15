import Link from "next/link";
import { searchEverything, type SearchHit } from "@/services/search";
import { SearchInput } from "@/ui/search-input";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q ?? "";
  const result = q
    ? await searchEverything(q)
    : { references: [], drawings: [], users: [], total: 0 };

  return (
    <main className="container space-y-6 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Search</h1>
        <SearchInput defaultValue={q} />
      </div>

      {q ? (
        <p className="text-sm text-muted-foreground">
          {result.total} result{result.total === 1 ? "" : "s"} for{" "}
          <span className="font-semibold">{q}</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Type to search.</p>
      )}

      <Section title="References" items={result.references} />
      <Section title="Drawings" items={result.drawings} />
      <UsersSection items={result.users} />
    </main>
  );
}

function Section({ title, items }: { title: string; items: SearchHit[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title} ({items.length})
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((hit) => (
          <Link
            key={hit.id}
            href={hit.href as `/library/${string}` | `/drawings/${string}` | `/u/${string}`}
            className="group block overflow-hidden rounded border border-border bg-card"
          >
            <div className="aspect-square overflow-hidden bg-muted">
              {hit.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hit.imageUrl}
                  alt={hit.title}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : null}
            </div>
            <div className="p-2">
              <p className="line-clamp-1 text-xs font-medium">{hit.title}</p>
              <p className="line-clamp-1 text-[10px] text-muted-foreground">{hit.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function UsersSection({ items }: { items: SearchHit[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Users ({items.length})
      </h2>
      <ul className="space-y-1">
        {items.map((hit) => (
          <li key={hit.id}>
            <Link
              href={hit.href as `/u/${string}`}
              className="flex items-center gap-3 rounded border border-border bg-card p-2 hover:bg-secondary"
            >
              {hit.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hit.imageUrl}
                  alt={hit.title}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-muted" />
              )}
              <div>
                <p className="text-sm font-medium">{hit.title}</p>
                {hit.subtitle ? (
                  <p className="text-xs text-muted-foreground">{hit.subtitle}</p>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
