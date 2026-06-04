import { NextResponse, type NextRequest } from "next/server";
import { TagKind } from "@prisma/client";
import { withTagApiAuth } from "@/lib/tag-api-route";
import { listTags } from "@/services/tag-management";

export const dynamic = "force-dynamic";

export const GET = withTagApiAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const limit = Number.parseInt(searchParams.get("limit") ?? "100", 10);
  const offset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
  const kindParam = searchParams.get("kind");
  const kind = kindParam === "ADMIN" ? TagKind.ADMIN : TagKind.USER;

  const result = await listTags({ q, limit, offset, kind });
  return NextResponse.json(result);
});
