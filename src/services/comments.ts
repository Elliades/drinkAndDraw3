import "server-only";
import { prisma } from "@/db/client";
import { TargetType } from "@prisma/client";

const MAX_BODY = 2000;

export interface CommentNode {
  id: string;
  body: string;
  createdAt: Date;
  deletedAt: Date | null;
  user: { id: string; handle: string | null; name: string | null; image: string | null };
  parentCommentId: string | null;
  replies: CommentNode[];
}

export async function listComments(target: {
  type: TargetType;
  id: string;
}): Promise<CommentNode[]> {
  const where =
    target.type === TargetType.REFERENCE
      ? { targetType: TargetType.REFERENCE, referenceId: target.id }
      : { targetType: TargetType.DRAWING, drawingId: target.id };

  const rows = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, handle: true, name: true, image: true } },
    },
  });

  const byId = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      body: r.deletedAt ? "[deleted]" : r.body,
      createdAt: r.createdAt,
      deletedAt: r.deletedAt,
      user: r.user,
      parentCommentId: r.parentCommentId,
      replies: [],
    });
  }
  for (const r of rows) {
    const node = byId.get(r.id)!;
    if (r.parentCommentId && byId.has(r.parentCommentId)) {
      byId.get(r.parentCommentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function createComment(opts: {
  userId: string;
  target: { type: TargetType; id: string };
  body: string;
  parentCommentId?: string | null;
}): Promise<{ id: string } | { ok: false; reason: string }> {
  const body = opts.body.trim();
  if (!body) return { ok: false, reason: "Empty comment." };
  if (body.length > MAX_BODY) return { ok: false, reason: "Comment too long." };

  if (opts.parentCommentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: opts.parentCommentId },
      select: { id: true, targetType: true, referenceId: true, drawingId: true },
    });
    if (!parent || parent.targetType !== opts.target.type) {
      return { ok: false, reason: "Invalid parent comment." };
    }
    if (parent.targetType === TargetType.REFERENCE && parent.referenceId !== opts.target.id) {
      return { ok: false, reason: "Parent on different target." };
    }
    if (parent.targetType === TargetType.DRAWING && parent.drawingId !== opts.target.id) {
      return { ok: false, reason: "Parent on different target." };
    }
  }

  const created = await prisma.comment.create({
    data: {
      userId: opts.userId,
      targetType: opts.target.type,
      body,
      parentCommentId: opts.parentCommentId ?? null,
      referenceId: opts.target.type === TargetType.REFERENCE ? opts.target.id : null,
      drawingId: opts.target.type === TargetType.DRAWING ? opts.target.id : null,
    },
    select: { id: true },
  });
  return created;
}

export async function softDeleteComment(opts: {
  commentId: string;
  userId: string;
  isAdmin: boolean;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const row = await prisma.comment.findUnique({
    where: { id: opts.commentId },
    select: { userId: true, deletedAt: true },
  });
  if (!row) return { ok: false, reason: "Not found" };
  if (row.userId !== opts.userId && !opts.isAdmin) {
    return { ok: false, reason: "forbidden" };
  }
  if (row.deletedAt) return { ok: true };
  await prisma.comment.update({
    where: { id: opts.commentId },
    data: { deletedAt: new Date() },
  });
  return { ok: true };
}
