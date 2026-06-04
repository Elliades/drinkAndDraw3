import { NextResponse, type NextRequest } from "next/server";
import { NormalizeBodySchema } from "@/lib/tag-api-schemas";
import { withTagApiAuth } from "@/lib/tag-api-route";
import { normalizeAllUserTags } from "@/services/tag-management";

export const dynamic = "force-dynamic";

export const POST = withTagApiAuth(async (req: NextRequest) => {
  const body = NormalizeBodySchema.parse(
    req.headers.get("content-length") === "0" ? {} : await req.json(),
  );
  const stats = await normalizeAllUserTags({ dryRun: body.dryRun ?? false });
  return NextResponse.json(stats);
});
