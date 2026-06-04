import NextAuth from "next-auth";
import { authConfig } from "@/auth/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (Auth.js endpoints handle their own session)
     * - api/files (storage serving)
     * - api/health (platform health checks, e.g. Railway)
     * - _next/static, _next/image, favicon, public files
     * Middleware here only attaches the session cookie; route-level guards
     * (requireUser / requireAdmin) enforce access.
     */
    "/((?!api/auth|api/files|api/health|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)",
  ],
};
