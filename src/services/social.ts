import "server-only";
import { prisma } from "@/db/client";
import { VoteValue } from "@prisma/client";
import type { TargetType } from "@prisma/client";

export interface SocialCounts {
  favorites: number;
  upvotes: number;
  downvotes: number;
  score: number;
}

export interface ViewerSocialState {
  favorited: boolean;
  vote: "UP" | "DOWN" | null;
}

export async function getSocialCounts(
  target: { type: TargetType; id: string },
): Promise<SocialCounts> {
  const [favorites, upvotes, downvotes] = await Promise.all([
    prisma.favorite.count({ where: { targetType: target.type, targetId: target.id } }),
    prisma.vote.count({
      where: { targetType: target.type, targetId: target.id, value: VoteValue.UP },
    }),
    prisma.vote.count({
      where: { targetType: target.type, targetId: target.id, value: VoteValue.DOWN },
    }),
  ]);
  return { favorites, upvotes, downvotes, score: upvotes - downvotes };
}

export async function getViewerSocialState(
  userId: string,
  target: { type: TargetType; id: string },
): Promise<ViewerSocialState> {
  const [fav, vote] = await Promise.all([
    prisma.favorite.findUnique({
      where: {
        userId_targetType_targetId: {
          userId,
          targetType: target.type,
          targetId: target.id,
        },
      },
    }),
    prisma.vote.findUnique({
      where: {
        userId_targetType_targetId: {
          userId,
          targetType: target.type,
          targetId: target.id,
        },
      },
    }),
  ]);
  return { favorited: !!fav, vote: vote ? vote.value : null };
}

export async function toggleFavorite(opts: {
  userId: string;
  target: { type: TargetType; id: string };
}): Promise<{ favorited: boolean }> {
  const existing = await prisma.favorite.findUnique({
    where: {
      userId_targetType_targetId: {
        userId: opts.userId,
        targetType: opts.target.type,
        targetId: opts.target.id,
      },
    },
  });
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return { favorited: false };
  }
  await prisma.favorite.create({
    data: {
      userId: opts.userId,
      targetType: opts.target.type,
      targetId: opts.target.id,
    },
  });
  return { favorited: true };
}

export async function castVote(opts: {
  userId: string;
  target: { type: TargetType; id: string };
  value: VoteValue | null; // null = clear
}): Promise<{ vote: "UP" | "DOWN" | null }> {
  const existing = await prisma.vote.findUnique({
    where: {
      userId_targetType_targetId: {
        userId: opts.userId,
        targetType: opts.target.type,
        targetId: opts.target.id,
      },
    },
  });
  if (opts.value === null) {
    if (existing) await prisma.vote.delete({ where: { id: existing.id } });
    return { vote: null };
  }
  if (existing) {
    if (existing.value === opts.value) {
      await prisma.vote.delete({ where: { id: existing.id } });
      return { vote: null };
    }
    await prisma.vote.update({
      where: { id: existing.id },
      data: { value: opts.value },
    });
    return { vote: opts.value };
  }
  await prisma.vote.create({
    data: {
      userId: opts.userId,
      targetType: opts.target.type,
      targetId: opts.target.id,
      value: opts.value,
    },
  });
  return { vote: opts.value };
}
