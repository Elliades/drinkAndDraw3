import { NextResponse, type NextRequest } from "next/server";
import { listReferences } from "@/services/references";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const folder = searchParams.get("folder") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const sort = searchParams.get("sort") === "random" ? "random" : "recent";
  const seed = searchParams.get("seed") ?? undefined;
  const tags = searchParams.getAll("tag").filter(Boolean);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "48", 10) || 48),
  );

  const result = await listReferences({
    folder,
    tags,
    search: q,
    page,
    pageSize,
    sort,
    randomSeed: seed,
  });

  return NextResponse.json(result);
}
