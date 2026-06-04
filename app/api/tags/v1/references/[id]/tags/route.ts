import { NextResponse, type NextRequest } from "next/server";
import { TagKind } from "@prisma/client";
import { SetReferenceTagsBodySchema, AddReferenceTagBodySchema } from "@/lib/tag-api-schemas";
import { withTagApiAuth } from "@/lib/tag-api-route";
import {
  addReferenceTag,
  getReferenceTags,
  setReferenceTags,
} from "@/services/tag-management";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export const GET = withTagApiAuth(async (_req: NextRequest, ctx: RouteCtx) => {
  const { id } = await ctx.params;
  const kindParam = new URL(_req.url).searchParams.get("kind");
  const kind = kindParam === "ADMIN" ? TagKind.ADMIN : TagKind.USER;
  const tags = await getReferenceTags(id, kind);
  return NextResponse.json({ referenceId: id, tags, kind });
});

export const PUT = withTagApiAuth(async (req: NextRequest, ctx: RouteCtx) => {
  const { id } = await ctx.params;
  const body = SetReferenceTagsBodySchema.parse(await req.json());
  const kind = body.kind === "ADMIN" ? TagKind.ADMIN : TagKind.USER;
  const result = await setReferenceTags({
    referenceId: id,
    tagNames: body.tags,
    kind,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 404 });
  }
  return NextResponse.json({ referenceId: id, tags: result.tags, kind });
});

export const POST = withTagApiAuth(async (req: NextRequest, ctx: RouteCtx) => {
  const { id } = await ctx.params;
  const body = AddReferenceTagBodySchema.parse(await req.json());
  const kind = body.kind === "ADMIN" ? TagKind.ADMIN : TagKind.USER;
  const result = await addReferenceTag({
    referenceId: id,
    tagName: body.tag,
    kind,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  const tags = await getReferenceTags(id, kind);
  return NextResponse.json({ referenceId: id, tags, kind });
});
