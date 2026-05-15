export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (Auth.js endpoints handle their own session)
     * - api/files (storage serving)
     * - _next/static, _next/image, favicon, public files
     * Middleware here only attaches the session cookie; route-level guards
     * (requireUser / requireAdmin) enforce access.
     */
    "/((?!api/auth|api/files|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)",
  ],
};
