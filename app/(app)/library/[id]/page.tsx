import Link from "next/link";
import { notFound } from "next/navigation";
import { TargetType } from "@prisma/client";
import { getOptionalUser } from "@/auth/guards";
import { getReferenceById } from "@/services/references";
import { Badge } from "@/ui/badge";
import { SocialBar } from "@/ui/social-bar";
import { CommentSection } from "@/ui/comment-section";
import { PoseAnalyzerClient } from "@/features/pose/components/PoseAnalyzerClient";
import { ReferenceAdminPanel } from "./ReferenceAdminPanel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function ReferenceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ref = await getReferenceById(id);
  if (!ref) notFound();
  const user = await getOptionalUser();
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <PoseAnalyzerClient src={ref.url} alt={ref.title ?? ref.filename} />
      <aside className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {ref.folderPath || "(root)"}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {ref.title ?? ref.filename}
          </h1>
          {ref.width && ref.height ? (
            <p className="text-sm text-muted-foreground">
              {ref.width} × {ref.height}
            </p>
          ) : null}
        </div>

        {isAdmin ? (
          <ReferenceAdminPanel reference={ref} />
        ) : ref.tags.length > 0 ? (
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tags
            </h2>
            <div className="flex flex-wrap gap-1">
              {ref.tags.map((t) => (
                <Link key={t} href={{ pathname: "/library", query: { tag: t } }}>
                  <Badge className="cursor-pointer hover:bg-primary/15">{t}</Badge>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No tags yet.</p>
        )}

        <SocialBar targetType={TargetType.REFERENCE} targetId={ref.id} />

        <div className="flex flex-col gap-2">
          <Link
            href={{ pathname: "/practice/session", query: { tags: ref.tags.join(",") } }}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Practice with this image
          </Link>
          <Link
            href={ref.folderPath ? { pathname: "/library", query: { folder: ref.folderPath } } : "/library"}
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-secondary"
          >
            Back to library
          </Link>
        </div>

        <CommentSection targetType={TargetType.REFERENCE} targetId={ref.id} />
      </aside>
    </div>
  );
}
