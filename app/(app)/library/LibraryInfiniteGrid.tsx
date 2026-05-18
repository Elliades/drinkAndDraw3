"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ReferenceListItem } from "@/services/references";
import { Badge } from "@/ui/badge";

const PAGE_SIZE = 48;
const PREFETCH_ROOT_MARGIN = "480px 0px";

export interface LibraryGridFilters {
  folder?: string;
  tags: string[];
  q?: string;
  sort: "recent" | "random";
  seed?: string;
}

interface LibraryInfiniteGridProps {
  initialItems: ReferenceListItem[];
  initialPage: number;
  totalPages: number;
  filters: LibraryGridFilters;
}

function buildFetchUrl(page: number, filters: LibraryGridFilters): string {
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  sp.set("pageSize", String(PAGE_SIZE));
  if (filters.folder) sp.set("folder", filters.folder);
  if (filters.q) sp.set("q", filters.q);
  for (const t of filters.tags) sp.append("tag", t);
  if (filters.sort === "random") {
    sp.set("sort", "random");
    if (filters.seed) sp.set("seed", filters.seed);
  }
  return `/api/library/references?${sp.toString()}`;
}

function ReferenceCard({ item }: { item: ReferenceListItem }) {
  return (
    <Link
      href={{ pathname: `/library/${item.id}` }}
      className="group mb-3 block break-inside-avoid overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <div className="overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.title ?? item.filename}
          className="block h-auto w-full transition-transform duration-300 group-hover:scale-[1.03]"
          style={
            item.width && item.height
              ? { aspectRatio: `${item.width}/${item.height}` }
              : undefined
          }
          loading="lazy"
        />
      </div>
      <div className="p-2.5">
        <p className="line-clamp-1 text-xs font-medium">{item.title ?? item.filename}</p>
        {item.tags.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.tags.slice(0, 2).map((t) => (
              <Badge key={t} className="px-1.5 py-0 text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export function LibraryInfiniteGrid({
  initialItems,
  initialPage,
  totalPages,
  filters,
}: LibraryInfiniteGridProps) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(initialPage);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const hasMore = page < totalPages;

  useEffect(() => {
    setItems(initialItems);
    setPage(initialPage);
    setStatus("idle");
    loadingRef.current = false;
  }, [initialItems, initialPage]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || page >= totalPages || status === "error") return;
    loadingRef.current = true;
    setStatus("loading");
    const nextPage = page + 1;
    try {
      const res = await fetch(buildFetchUrl(nextPage, filters));
      if (!res.ok) throw new Error(`Failed to load page ${nextPage}`);
      const data = (await res.json()) as { items: ReferenceListItem[] };
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        const appended = data.items.filter((i) => !seen.has(i.id));
        return appended.length > 0 ? [...prev, ...appended] : prev;
      });
      setPage(nextPage);
      setStatus("idle");
    } catch {
      setStatus("error");
    } finally {
      loadingRef.current = false;
    }
  }, [page, totalPages, filters, status]);

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

  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5 [column-fill:_balance]">
        {items.map((item) => (
          <ReferenceCard key={item.id} item={item} />
        ))}
      </div>
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
          Could not load more images.{" "}
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
    </div>
  );
}

