import { NextResponse, type NextRequest } from "next/server";
import { getRandomReference } from "@/services/references";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tagsParam = searchParams.get("tags");
  const tags = tagsParam ? tagsParam.split(",").map((t) => t.trim()) : [];

  const ref = await getRandomReference(tags);
  if (!ref) {
    return NextResponse.json({ error: "no references found" }, { status: 404 });
  }
  return NextResponse.json(ref);
}
