import Link from "next/link";
import { notFound } from "next/navigation";
import { TargetType } from "@prisma/client";
import { getOptionalUser } from "@/auth/guards";
import { getDrawingById } from "@/services/drawings";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { SocialBar } from "@/ui/social-bar";
import { CommentSection } from "@/ui/comment-section";
import {
  addDrawingTagAction,
  deleteDrawingAction,
  removeDrawingTagAction,
} from "./actions";
import { prisma } from "@/db/client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function DrawingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const drawing = await getDrawingById(id);
  if (!drawing) notFound();

  const viewer = await getOptionalUser();
  const owner = await prisma.drawing.findUnique({
    where: { id },
    select: { ownerId: true, owner: { select: { handle: true, name: true } } },
  });
  const isOwner = !!viewer && owner?.ownerId === viewer.id;

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={drawing.url}
          alt={drawing.title ?? drawing.filename}
          className="h-auto w-full object-contain"
        />
      </div>

      <aside className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {drawing.title ?? drawing.filename}
          </h1>
          <p className="text-sm text-muted-foreground">
            by{" "}
            {owner?.owner.handle ? (
              <Link href={`/u/${owner.owner.handle}`} className="underline">
                @{owner.owner.handle}
              </Link>
            ) : (
              owner?.owner.name ?? "unknown"
            )}
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Tags
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {drawing.tags.map((t) =>
              isOwner ? (
                <form key={t} action={removeDrawingTagAction}>
                  <input type="hidden" name="drawingId" value={drawing.id} />
                  <input type="hidden" name="tagName" value={t} />
                  <button type="submit">
                    <Badge className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground">
                      {t} ×
                    </Badge>
                  </button>
                </form>
              ) : (
                <Badge key={t}>{t}</Badge>
              ),
            )}
            {isOwner ? (
              <form action={addDrawingTagAction} className="inline-flex items-center gap-1">
                <input type="hidden" name="drawingId" value={drawing.id} />
                <Input name="tagName" placeholder="add tag" className="h-7 w-28 text-xs" />
                <Button type="submit" size="sm" variant="outline">
                  +
                </Button>
              </form>
            ) : null}
          </div>
        </div>

        {drawing.referenceId ? (
          <Link
            href={{ pathname: `/library/${drawing.referenceId}` }}
            className="block rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            View original reference →
          </Link>
        ) : null}

        <SocialBar targetType={TargetType.DRAWING} targetId={drawing.id} />

        {isOwner ? (
          <form action={deleteDrawingAction}>
            <input type="hidden" name="drawingId" value={drawing.id} />
            <Button type="submit" variant="destructive" className="w-full">
              Delete drawing
            </Button>
          </form>
        ) : null}

        <CommentSection targetType={TargetType.DRAWING} targetId={drawing.id} />
      </aside>
    </div>
  );
}
