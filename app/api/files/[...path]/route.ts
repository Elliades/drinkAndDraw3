import { NextResponse, type NextRequest } from "next/server";
import { getStorage } from "@/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Serve a stored object by key. Primarily used by the local storage driver in dev;
 * in production the S3 driver returns signed URLs so this route is rarely hit.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path: parts } = await params;
  if (!parts || parts.length === 0) {
    return NextResponse.json({ error: "missing path" }, { status: 400 });
  }
  const key = parts.map((p) => decodeURIComponent(p)).join("/");
  const storage = getStorage();

  try {
    const obj = await storage.read(key);
    return new NextResponse(new Uint8Array(obj.body), {
      status: 200,
      headers: {
        "Content-Type": obj.contentType,
        "Content-Length": String(obj.size),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    logger.warn({ key }, "file serve: not found");
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
