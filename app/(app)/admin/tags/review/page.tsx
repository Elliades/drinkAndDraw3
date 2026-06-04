import Link from "next/link";
import { requireAdmin } from "@/auth/guards";
import { listNumericReviewQueue } from "@/services/tag-management";

export const dynamic = "force-dynamic";

export default async function AdminTagsReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const { items, total, pageSize } = await listNumericReviewQueue({ page, pageSize: 50 });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">
          Admin
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Numeric tag review</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          References with bare numeric tags (e.g. <code className="text-foreground">1</code>,{" "}
          <code className="text-foreground">2</code>) and no <code className="text-foreground">female</code> or{" "}
          <code className="text-foreground">male</code> tag. Open each link to add the correct gendered tag in the
          library admin panel.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} reference{total === 1 ? "" : "s"} need review · page {page} of {totalPages}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No references in the review queue.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-3 py-2 font-medium">Storage key</th>
                <th className="px-3 py-2 font-medium">Numeric tags</th>
                <th className="px-3 py-2 font-medium">All USER tags</th>
                <th className="px-3 py-2 font-medium">Open</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.referenceId} className="border-b border-border last:border-0">
                  <td className="max-w-md truncate px-3 py-2 font-mono text-xs" title={row.storageKey}>
                    {row.storageKey}
                  </td>
                  <td className="px-3 py-2">{row.numericTags.join(", ")}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-muted-foreground" title={row.tags.join(", ")}>
                    {row.tags.join(", ")}
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={row.url}
                      className="text-primary underline-offset-4 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Library
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex gap-4 text-sm">
          {page > 1 && (
            <Link href={`/admin/tags/review?page=${page - 1}`} className="text-primary hover:underline">
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link href={`/admin/tags/review?page=${page + 1}`} className="text-primary hover:underline">
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
