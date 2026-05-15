import Link from "next/link";
import { NavLink } from "@/ui/nav-link";
import { SearchInput } from "@/ui/search-input";
import { ThemeToggle } from "@/ui/theme-toggle";
import { getOptionalUser } from "@/auth/guards";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getOptionalUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between gap-4">
          <Link
            href="/"
            className="font-display text-lg font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"
          >
            drinkAndDraw
          </Link>
          <nav className="flex items-center gap-0.5">
            <NavLink href="/practice">Practice</NavLink>
            <NavLink href="/library">Library</NavLink>
            <NavLink href="/drawings">Drawings</NavLink>
            {user?.role === "ADMIN" ? <NavLink href="/admin">Admin</NavLink> : null}
          </nav>
          <div className="flex flex-1 items-center justify-end gap-2">
            <div className="hidden flex-1 md:block md:max-w-xs">
              <SearchInput />
            </div>
            <ThemeToggle />
            {user ? (
              <Link
                href={user.handle ? `/u/${user.handle}` : "/profile"}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {user.handle ?? user.name ?? user.email}
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="container flex-1 py-8">{children}</main>
    </div>
  );
}
