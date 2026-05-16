import { NextResponse, type NextRequest } from "next/server";
import { getStorage } from "@/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Public reference files; allows `<img crossOrigin="anonymous">` and canvas read. */
const FILE_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function mergeFileHeaders(base: Record<string, string>): Headers {
  const h = new Headers(base);
  for (const [k, v] of Object.entries(FILE_CORS_HEADERS)) {
    h.set(k, v);
  }
  return h;
}

/**
 * Next.js decodes URL segments once. Prefer joined segments; if the file is
 * missing, try segment-wise decode for legacy/double-encoded links.
 */
function storageKeyCandidates(parts: string[]): string[] {
  const joined = parts.join("/");
  const reDecoded = parts
    .map((seg) => {
      try {
        return decodeURIComponent(seg);
      } catch {
        return seg;
      }
    })
    .join("/");
  return reDecoded === joined ? [joined] : [joined, reDecoded];
}

export function OPTIONS(): Response {
  return new NextResponse(null, { status: 204, headers: FILE_CORS_HEADERS });
}

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
    return NextResponse.json(
      { error: "missing path" },
      { status: 400, headers: FILE_CORS_HEADERS },
    );
  }
  const candidates = storageKeyCandidates(parts);
  const storage = getStorage();

  for (const key of candidates) {
    try {
      const obj = await storage.read(key);
      return new NextResponse(new Uint8Array(obj.body), {
        status: 200,
        headers: mergeFileHeaders({
          "Content-Type": obj.contentType,
          "Content-Length": String(obj.size),
          "Cache-Control": "public, max-age=3600",
        }),
      });
    } catch {
      /* try next candidate */
    }
  }

  logger.warn({ keysTried: candidates }, "file serve: not found");
  return NextResponse.json({ error: "not found" }, { status: 404, headers: FILE_CORS_HEADERS });
}
