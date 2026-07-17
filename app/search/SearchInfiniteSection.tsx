"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { SearchHit, SearchHitType, SearchTypePage } from "@/services/search";

const PAGE_SIZE = 24;
const PREFETCH_ROOT_MARGIN = "480px 0px";

interface SearchInfiniteSectionProps {
  title: string;
  q: string;
  type: SearchHitType;
  initial: SearchTypePage;
  variant: "grid" | "users";
}

export function SearchInfiniteSection({
  title,
  q,
  type,
  initial,
  variant,
}: SearchInfiniteSectionProps) {
  const [items, setItems] = useState(initial.items);
  const [page, setPage] = useState(initial.page);
  const [totalPages, setTotalPages] = useState(initial.totalPages);
  const [total, setTotal] = useState(initial.total);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const hasMore = page < totalPages;

  useEffect(() => {
    setItems(initial.items);
    setPage(initial.page);
    setTotalPages(initial.totalPages);
    setTotal(initial.total);
    setStatus("idle");
    loadingRef.current = false;
  }, [initial]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || page >= totalPages || status === "error") return;
    loadingRef.current = true;
    setStatus("loading");
    const nextPage = page + 1;
    try {
      const sp = new URLSearchParams({
        q,
        type,
        page: String(nextPage),
        pageSize: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/search?${sp.toString()}`);
      if (!res.ok) throw new Error(`Failed to load page ${nextPage}`);
      const data = (await res.json()) as SearchTypePage;
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        const appended = data.items.filter((i) => !seen.has(i.id));
        return appended.length > 0 ? [...prev, ...appended] : prev;
      });
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
      setStatus("idle");
    } catch {
      setStatus("error");
    } finally {
      loadingRef.current = false;
    }
  }, [page, totalPages, q, type, status]);

  useEffect(() => {
    if (!hasMore || status === "error") return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: PREFETCH_ROOT_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore, status]);

  if (total === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title} ({total.toLocaleString()})
      </h2>
      {variant === "grid" ? <HitGrid items={items} /> : <UsersList items={items} />}
      {hasMore ? (
        <div
          ref={sentinelRef}
          className="flex min-h-12 items-center justify-center py-4"
          aria-hidden={status !== "loading"}
        >
          {status === "loading" ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading more" />
          ) : null}
        </div>
      ) : null}
      {status === "error" ? (
        <p className="text-center text-sm text-muted-foreground">
          Could not load more results.{" "}
          <button
            type="button"
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => {
              setStatus("idle");
              void loadMore();
            }}
          >
            Try again
          </button>
        </p>
      ) : null}
    </section>
  );
}

function HitGrid({ items }: { items: SearchHit[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((hit) => (
        <Link
          key={hit.id}
          href={hit.href as `/library/${string}` | `/drawings/${string}` | `/u/${string}`}
          className="group block overflow-hidden rounded border border-border bg-card"
        >
          <div className="aspect-square overflow-hidden bg-muted">
            {hit.thumbnailUrl ?? hit.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hit.thumbnailUrl ?? hit.imageUrl}
                alt={hit.title}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            ) : null}
          </div>
          <div className="p-2">
            <p className="line-clamp-1 text-xs font-medium">{hit.title}</p>
            <p className="line-clamp-1 text-[10px] text-muted-foreground">{hit.subtitle}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function UsersList({ items }: { items: SearchHit[] }) {
  return (
    <ul className="space-y-1">
      {items.map((hit) => (
        <li key={hit.id}>
          <Link
            href={hit.href as `/u/${string}`}
            className="flex items-center gap-3 rounded border border-border bg-card p-2 hover:bg-secondary"
          >
            {hit.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hit.imageUrl}
                alt={hit.title}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-muted" />
            )}
            <div>
              <p className="text-sm font-medium">{hit.title}</p>
              {hit.subtitle ? (
                <p className="text-xs text-muted-foreground">{hit.subtitle}</p>
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
