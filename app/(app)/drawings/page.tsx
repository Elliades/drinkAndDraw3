import Link from "next/link";
import { requireUser } from "@/auth/guards";
import { listDrawings } from "@/services/drawings";
import { Card } from "@/ui/card";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export const dynamic = "force-dynamic";

export default async function MyDrawingsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const result = await listDrawings({ ownerId: user.id, page, pageSize: 24 });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My drawings</h1>
          <p className="text-sm text-muted-foreground">{result.total} total</p>
        </div>
        <Link
          href="/drawings/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Upload
        </Link>
      </div>

      {result.items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No drawings yet.{" "}
          <Link className="underline" href="/drawings/new">
            Upload your first
          </Link>
          .
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {result.items.map((d) => (
            <Link
              key={d.id}
              href={{ pathname: `/drawings/${d.id}` }}
              className="group block overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="aspect-square overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.url}
                  alt={d.title ?? d.filename}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <div className="p-3">
                <p className="line-clamp-1 text-sm font-medium">
                  {d.title ?? d.filename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d.createdAt)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
