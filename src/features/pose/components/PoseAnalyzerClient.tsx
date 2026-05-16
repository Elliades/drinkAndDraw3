"use client";

import dynamic from "next/dynamic";

/**
 * Thin client wrapper around `PoseAnalyzer` that loads the (sizeable)
 * MediaPipe-using module lazily on the client. Use this from server
 * components (e.g. /library/[id]) to keep MediaPipe out of the initial
 * SSR/HTML bundle.
 */
export const PoseAnalyzerClient = dynamic(
  () =>
    import("./PoseAnalyzer").then((m) => ({ default: m.PoseAnalyzer })),
  {
    ssr: false,
    loading: () => (
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div
          className="h-96 w-full animate-pulse bg-muted"
          aria-hidden="true"
        />
      </div>
    ),
  },
);
