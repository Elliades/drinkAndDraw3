import { NextResponse, type NextRequest } from "next/server";
import { searchByType, type SearchHitType } from "@/services/search";

export const dynamic = "force-dynamic";

const TYPES = new Set<SearchHitType>(["REFERENCE", "DRAWING", "USER"]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const typeParam = (searchParams.get("type") ?? "").toUpperCase();
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "24", 10) || 24),
  );

  if (!q) {
    return NextResponse.json({ error: "Missing q" }, { status: 400 });
  }
  if (!TYPES.has(typeParam as SearchHitType)) {
    return NextResponse.json(
      { error: "type must be REFERENCE, DRAWING, or USER" },
      { status: 400 },
    );
  }

  const result = await searchByType(q, typeParam as SearchHitType, { page, pageSize });
  return NextResponse.json(result);
}
