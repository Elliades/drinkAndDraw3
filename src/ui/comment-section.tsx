import Link from "next/link";
import type { TargetType } from "@prisma/client";
import { listComments, type CommentNode } from "@/services/comments";
import { getOptionalUser } from "@/auth/guards";
import {
  createCommentAction,
  deleteCommentAction,
} from "@/server-actions/social";
import { Button } from "@/ui/button";

interface Props {
  targetType: TargetType;
  targetId: string;
}

export async function CommentSection({ targetType, targetId }: Props) {
  const [viewer, comments] = await Promise.all([
    getOptionalUser(),
    listComments({ type: targetType, id: targetId }),
  ]);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Comments ({flatCount(comments)})</h2>

      {viewer ? (
        <form action={createCommentAction} className="space-y-2">
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <textarea
            name="body"
            required
            maxLength={2000}
            rows={3}
            placeholder="Write a comment…"
            className="w-full rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" size="sm">
            Post
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link className="underline" href="/login">
            Sign in
          </Link>{" "}
          to comment.
        </p>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              node={c}
              viewerId={viewer?.id ?? null}
              isAdmin={viewer?.role === "ADMIN"}
              targetType={targetType}
              targetId={targetId}
              depth={0}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function flatCount(nodes: CommentNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + flatCount(n.replies), 0);
}

function CommentItem({
  node,
  viewerId,
  isAdmin,
  targetType,
  targetId,
  depth,
}: {
  node: CommentNode;
  viewerId: string | null;
  isAdmin: boolean;
  targetType: TargetType;
  targetId: string;
  depth: number;
}) {
  const canDelete = viewerId && (viewerId === node.user.id || isAdmin) && !node.deletedAt;
  return (
    <li className={depth > 0 ? "ml-6 border-l border-border pl-3" : ""}>
      <div className="rounded-md bg-secondary/30 p-2 text-sm">
        <header className="mb-1 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {node.user.handle ? (
              <Link href={`/u/${node.user.handle}`} className="underline">
                @{node.user.handle}
              </Link>
            ) : (
              node.user.name ?? "anonymous"
            )}{" "}
            ·{" "}
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(node.createdAt)}
          </span>
          {canDelete ? (
            <form action={deleteCommentAction} className="inline-flex">
              <input type="hidden" name="commentId" value={node.id} />
              <input type="hidden" name="targetType" value={targetType} />
              <input type="hidden" name="targetId" value={targetId} />
              <button type="submit" className="text-xs text-muted-foreground hover:text-destructive">
                delete
              </button>
            </form>
          ) : null}
        </header>
        <p className="whitespace-pre-wrap">{node.body}</p>
      </div>
      {node.replies.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {node.replies.map((r) => (
            <CommentItem
              key={r.id}
              node={r}
              viewerId={viewerId}
              isAdmin={isAdmin}
              targetType={targetType}
              targetId={targetId}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
