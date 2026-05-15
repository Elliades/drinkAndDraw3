import { Heart, ThumbsDown, ThumbsUp } from "lucide-react";
import type { TargetType } from "@prisma/client";
import { getSocialCounts, getViewerSocialState } from "@/services/social";
import { getOptionalUser } from "@/auth/guards";
import {
  toggleFavoriteAction,
  voteAction,
} from "@/server-actions/social";
import { cn } from "@/lib/utils";

interface Props {
  targetType: TargetType;
  targetId: string;
}

export async function SocialBar({ targetType, targetId }: Props) {
  const counts = await getSocialCounts({ type: targetType, id: targetId });
  const viewer = await getOptionalUser();
  const state = viewer
    ? await getViewerSocialState(viewer.id, { type: targetType, id: targetId })
    : { favorited: false, vote: null as "UP" | "DOWN" | null };

  return (
    <div className="flex items-center gap-2">
      <form action={voteAction} className="inline-flex">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="value" value="UP" />
        <button
          type="submit"
          className={cn(
            "inline-flex h-9 items-center gap-1 rounded-md border border-border px-2 text-sm hover:bg-secondary",
            state.vote === "UP" && "border-primary text-primary",
          )}
          aria-label="Upvote"
        >
          <ThumbsUp className="h-4 w-4" />
          {counts.upvotes}
        </button>
      </form>
      <form action={voteAction} className="inline-flex">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="value" value="DOWN" />
        <button
          type="submit"
          className={cn(
            "inline-flex h-9 items-center gap-1 rounded-md border border-border px-2 text-sm hover:bg-secondary",
            state.vote === "DOWN" && "border-destructive text-destructive",
          )}
          aria-label="Downvote"
        >
          <ThumbsDown className="h-4 w-4" />
          {counts.downvotes}
        </button>
      </form>
      <form action={toggleFavoriteAction} className="inline-flex">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <button
          type="submit"
          className={cn(
            "inline-flex h-9 items-center gap-1 rounded-md border border-border px-2 text-sm hover:bg-secondary",
            state.favorited && "border-destructive text-destructive",
          )}
          aria-label="Favorite"
        >
          <Heart className={cn("h-4 w-4", state.favorited && "fill-current")} />
          {counts.favorites}
        </button>
      </form>
    </div>
  );
}
