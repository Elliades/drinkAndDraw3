import { NextResponse, type NextRequest } from "next/server";

function readApiKey(req: NextRequest): string | null {
  const header = req.headers.get("x-tag-api-key");
  if (header?.trim()) return header.trim();
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return null;
}

export function assertTagApiKey(req: NextRequest): NextResponse | null {
  const expected = process.env.TAG_API_KEY?.trim();
  const provided = readApiKey(req);

  if (expected) {
    if (!provided || provided !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return null;
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "TAG_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  return null;
}
