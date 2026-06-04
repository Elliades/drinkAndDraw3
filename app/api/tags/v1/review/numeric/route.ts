import { NextResponse, type NextRequest } from "next/server";
import { withTagApiAuth } from "@/lib/tag-api-route";
import { listNumericReviewQueue } from "@/services/tag-management";

export const dynamic = "force-dynamic";

export const GET = withTagApiAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(searchParams.get("pageSize") ?? "50", 10);
  const result = await listNumericReviewQueue({ page, pageSize });
  return NextResponse.json(result);
});
