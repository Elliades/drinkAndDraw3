import { NextResponse, type NextRequest } from "next/server";
import {
  generateThumbFromStorageKey,
  readThumbFile,
  storageKeyFromThumbKey,
} from "@/media/thumbnails";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const THUMB_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function mergeThumbHeaders(base: Record<string, string>): Headers {
  const h = new Headers(base);
  for (const [k, v] of Object.entries(THUMB_CORS_HEADERS)) {
    h.set(k, v);
  }
  return h;
}

function thumbKeyCandidates(parts: string[]): string[] {
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
  return new NextResponse(null, { status: 204, headers: THUMB_CORS_HEADERS });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path: parts } = await params;
  if (!parts || parts.length === 0) {
    return NextResponse.json(
      { error: "missing path" },
      { status: 400, headers: THUMB_CORS_HEADERS },
    );
  }

  const candidates = thumbKeyCandidates(parts);

  for (const thumbRelKey of candidates) {
    let body = await readThumbFile(thumbRelKey);
    if (!body) {
      const storageKey = await storageKeyFromThumbKey(thumbRelKey);
      if (!storageKey) continue;
      try {
        body = await generateThumbFromStorageKey(storageKey);
      } catch (err) {
        logger.warn({ err, thumbRelKey, storageKey }, "thumb generate failed");
        continue;
      }
    }

    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: mergeThumbHeaders({
        "Content-Type": "image/webp",
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=86400",
      }),
    });
  }

  logger.warn({ keysTried: candidates }, "thumb serve: not found");
  return NextResponse.json({ error: "not found" }, { status: 404, headers: THUMB_CORS_HEADERS });
}
