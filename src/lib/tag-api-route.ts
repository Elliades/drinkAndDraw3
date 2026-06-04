import { NextResponse, type NextRequest } from "next/server";
import { assertTagApiKey } from "@/lib/tag-api-auth";

export function withTagApiAuth<C = unknown>(
  handler: (req: NextRequest, ctx: C) => Promise<Response>,
): (req: NextRequest, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    const denied = assertTagApiKey(req);
    if (denied) return denied;
    try {
      return await handler(req, ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
