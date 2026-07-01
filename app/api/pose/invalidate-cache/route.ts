import { NextResponse } from "next/server";
import { invalidatePoseSearchCache } from "@/services/pose-search";

export const dynamic = "force-dynamic";

export async function POST() {
  invalidatePoseSearchCache();
  return NextResponse.json({ ok: true });
}
