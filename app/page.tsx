import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { getHomeSections } from "@/services/references";
import { SearchInput } from "@/ui/search-input";
import { ThemeToggle } from "@/ui/theme-toggle";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  return (
    <main>
      <div className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container flex h-14 items-center justify-between gap-4">
          <Link
            href="/"
            className="font-display text-lg font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"
          >
            drinkAndDraw
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/library"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Library
            </Link>
            <Link
              href="/practice"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Practice
            </Link>
            <ThemeToggle />
            <Link
              href="/login"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </div>

      <div className="container space-y-8 py-10">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-background to-secondary/30 px-8 py-12 border border-primary/10">
          <div className="relative z-10 max-w-lg space-y-4">
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Draw. Drink.{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Repeat.
              </span>
            </h1>
            <p className="text-base text-muted-foreground">
              Practice figure drawing from a curated library of reference images — timed sessions, any pose.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/practice"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
              >
                Start practising
              </Link>
              <Link
                href="/library"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Browse library
              </Link>
            </div>
          </div>
          {/* decorative blobs */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 right-24 h-40 w-40 rounded-full bg-secondary/40 blur-2xl" />
        </div>

        <div className="space-y-3">
          <SearchInput />
        </div>

        <Suspense fallback={<FeedSkeleton />}>
          <FeedGrid />
        </Suspense>
      </div>
    </main>
  );
}

// Duration and direction cycle for each section row
const ROW_STYLES = [
  { heightClass: "h-48", animation: "marquee 42s linear infinite" },
  { heightClass: "h-56", animation: "marquee-reverse 55s linear infinite" },
  { heightClass: "h-44", animation: "marquee 34s linear infinite" },
  { heightClass: "h-52", animation: "marquee-reverse 48s linear infinite" },
  { heightClass: "h-40", animation: "marquee 38s linear infinite" },
] as const;

function FeedSkeleton() {
  return (
    <div className="space-y-10">
      {[0, 1, 2].map((i) => {
        const row = ROW_STYLES[i % ROW_STYLES.length]!;
        return (
          <div key={i} className="space-y-3">
            {/* Title skeleton */}
            <div className="flex items-center justify-between px-1">
              <div className="h-5 w-40 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-16 animate-pulse rounded-md bg-muted" />
            </div>
            {/* Strip skeleton */}
            <div
              className={`${row.heightClass} flex gap-3 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]`}
            >
              {Array.from({ length: 9 }).map((_, j) => (
                <div
                  key={j}
                  className="h-full shrink-0 animate-pulse rounded-xl bg-muted"
                  style={{ width: `${100 + (j % 5) * 35}px` }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

async function FeedGrid() {
  let sections: Awaited<ReturnType<typeof getHomeSections>>;
  try {
    sections = await getHomeSections({ folderCount: 3 });
  } catch {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <p className="font-semibold text-destructive">Could not load the explore feed.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Is PostgreSQL running? From the project folder run{" "}
          <code className="rounded bg-muted px-1 py-0.5">docker compose up -d db</code> then{" "}
          <code className="rounded bg-muted px-1 py-0.5">npx prisma migrate deploy</code>.
        </p>
        <p className="mt-3">
          <Link className="font-medium text-primary underline-offset-2 hover:underline" href="/library">
            Try the library
          </Link>{" "}
          or{" "}
          <Link className="font-medium text-primary underline-offset-2 hover:underline" href="/practice">
            practice
          </Link>
          .
        </p>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
        Nothing here yet.{" "}
        <Link className="font-medium text-primary underline-offset-2 hover:underline" href="/library">
          Browse the library
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {sections.map((section, sectionIdx) => {
        const row = ROW_STYLES[sectionIdx % ROW_STYLES.length]!;
        const doubled = [...section.items, ...section.items];
        return (
          <div key={section.id} className="space-y-3">
            {/* Section header */}
            <div className="flex items-start justify-between gap-4 px-1">
              <div className="min-w-0 space-y-0.5">
                <h2 className="text-base font-semibold tracking-tight">{section.title}</h2>
                {section.subtitle ? (
                  <p className="text-xs text-muted-foreground">{section.subtitle}</p>
                ) : null}
              </div>
              {section.href && (
                <Link
                  href={section.href}
                  className="flex shrink-0 items-center gap-0.5 pt-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  View all <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

            {/* Marquee strip */}
            <div
              className={`${row.heightClass} overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]`}
            >
              <div
                className="flex h-full gap-3 hover:[animation-play-state:paused]"
                style={{ animation: row.animation }}
              >
                {doubled.map((item, i) => (
                  <Link
                    key={`${item.id}-${i}`}
                    href={`/library/${item.id}`}
                    className="group relative h-full shrink-0 overflow-hidden rounded-xl border border-border bg-muted shadow-sm transition-shadow hover:shadow-lg"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title ?? item.filename}
                      className="h-full w-auto object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                      width={item.width ?? undefined}
                      height={item.height ?? undefined}
                      style={
                        item.width && item.height
                          ? { aspectRatio: `${item.width}/${item.height}` }
                          : undefined
                      }
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <p className="line-clamp-2 text-xs font-medium leading-tight text-white">
                        {item.title ?? item.filename}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
