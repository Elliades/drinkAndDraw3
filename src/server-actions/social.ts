"use server";

import { revalidatePath } from "next/cache";
import { TargetType, VoteValue } from "@prisma/client";
import { requireUser } from "@/auth/guards";
import { castVote, toggleFavorite } from "@/services/social";
import { createComment, softDeleteComment } from "@/services/comments";
import { enforceRateLimit } from "@/lib/rate-limit";

function parseTarget(formData: FormData): { type: TargetType; id: string } | null {
  const t = String(formData.get("targetType") ?? "");
  const id = String(formData.get("targetId") ?? "");
  if (!id) return null;
  if (t !== "REFERENCE" && t !== "DRAWING") return null;
  return { type: t as TargetType, id };
}

function revalidateForTarget(target: { type: TargetType; id: string }): void {
  if (target.type === TargetType.REFERENCE) {
    revalidatePath(`/library/${target.id}`);
  } else {
    revalidatePath(`/drawings/${target.id}`);
  }
}

export async function toggleFavoriteAction(formData: FormData) {
  const user = await requireUser();
  const target = parseTarget(formData);
  if (!target) return;
  await toggleFavorite({ userId: user.id, target });
  revalidateForTarget(target);
}

export async function voteAction(formData: FormData) {
  const user = await requireUser();
  const target = parseTarget(formData);
  if (!target) return;
  const valueStr = String(formData.get("value") ?? "");
  const value = valueStr === "UP" ? VoteValue.UP : valueStr === "DOWN" ? VoteValue.DOWN : null;
  await castVote({ userId: user.id, target, value });
  revalidateForTarget(target);
}

export async function createCommentAction(formData: FormData) {
  const user = await requireUser();
  enforceRateLimit(`comment:${user.id}`, "comment");
  const target = parseTarget(formData);
  if (!target) return;
  const body = String(formData.get("body") ?? "");
  const parentId = String(formData.get("parentCommentId") ?? "") || null;
  await createComment({ userId: user.id, target, body, parentCommentId: parentId });
  revalidateForTarget(target);
}

export async function deleteCommentAction(formData: FormData) {
  const user = await requireUser();
  const commentId = String(formData.get("commentId") ?? "");
  if (!commentId) return;
  await softDeleteComment({
    commentId,
    userId: user.id,
    isAdmin: user.role === "ADMIN",
  });
  const target = parseTarget(formData);
  if (target) revalidateForTarget(target);
}
