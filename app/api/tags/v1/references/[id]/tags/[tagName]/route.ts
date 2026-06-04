import { NextResponse, type NextRequest } from "next/server";
import { TagKind } from "@prisma/client";
import { withTagApiAuth } from "@/lib/tag-api-route";
import { getReferenceTags, removeReferenceTag } from "@/services/tag-management";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string; tagName: string }> };

export const DELETE = withTagApiAuth(async (req: NextRequest, ctx: RouteCtx) => {
  const { id, tagName } = await ctx.params;
  const kindParam = new URL(req.url).searchParams.get("kind");
  const kind = kindParam === "ADMIN" ? TagKind.ADMIN : TagKind.USER;
  await removeReferenceTag({
    referenceId: id,
    tagName: decodeURIComponent(tagName),
    kind,
  });
  const tags = await getReferenceTags(id, kind);
  return NextResponse.json({ referenceId: id, tags, kind });
});
