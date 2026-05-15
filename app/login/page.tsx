import Link from "next/link";
import { signIn } from "@/auth";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export const dynamic = "force-dynamic";

const hasGoogle = !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;
const devSecret = process.env.AUTH_DEV_SECRET;
const hasDevLogin =
  process.env.NODE_ENV === "development" && typeof devSecret === "string" && devSecret.length >= 8;

export default function LoginPage() {
  const hasAnyProvider = hasGoogle || hasDevLogin;

  return (
    <div className="container flex min-h-screen flex-col items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="text-sm text-muted-foreground">to continue to drinkAndDraw</p>
        </div>

        {hasAnyProvider ? (
          <div className="space-y-4">
            {hasGoogle ? (
              <form
                action={async () => {
                  "use server";
                  await signIn("google", { redirectTo: "/" });
                }}
              >
                <Button type="submit" className="w-full" size="lg">
                  Continue with Google
                </Button>
              </form>
            ) : null}

            {hasGoogle && hasDevLogin ? (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
            ) : null}

            {hasDevLogin ? (
              <form
                className="space-y-3"
                action={async (formData) => {
                  "use server";
                  await signIn("dev", {
                    secret: String(formData.get("secret") ?? ""),
                    redirectTo: "/",
                  });
                }}
              >
                <div className="space-y-2">
                  <label htmlFor="dev-secret" className="text-sm font-medium leading-none">
                    Development secret
                  </label>
                  <Input
                    id="dev-secret"
                    name="secret"
                    type="password"
                    autoComplete="off"
                    required
                    placeholder="Matches AUTH_DEV_SECRET in .env.local"
                  />
                </div>
                <Button type="submit" variant="outline" className="w-full" size="lg">
                  Sign in (local dev)
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Only enabled when <code className="rounded bg-muted px-1">NODE_ENV</code> is development and{" "}
                  <code className="rounded bg-muted px-1">AUTH_DEV_SECRET</code> is set (8+ characters).
                </p>
              </form>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            <p className="text-center">No auth providers are configured. Choose one:</p>
            <ul className="list-inside list-disc space-y-1 text-left text-xs">
              <li>
                <strong className="text-foreground">Google (recommended):</strong> set{" "}
                <code className="rounded bg-muted px-1">AUTH_GOOGLE_ID</code> and{" "}
                <code className="rounded bg-muted px-1">AUTH_GOOGLE_SECRET</code> in{" "}
                <code className="rounded bg-muted px-1">.env.local</code>.
              </li>
              <li>
                <strong className="text-foreground">Local dev:</strong> add{" "}
                <code className="rounded bg-muted px-1">AUTH_DEV_SECRET</code> (8+ characters) for a password
                sign-in on this page. Optional: <code className="rounded bg-muted px-1">AUTH_DEV_EMAIL</code> for
                the dev user&apos;s email (defaults to dev@drinkanddraw.local).
              </li>
            </ul>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
