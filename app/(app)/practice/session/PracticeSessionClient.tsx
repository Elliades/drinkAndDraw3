"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/ui/button";
import { PoseAnalyzer } from "@/features/pose/components/PoseAnalyzer";

interface SessionImage {
  id: string;
  title: string | null;
  filename: string;
  url: string;
  folderPath: string;
  tags: string[];
  poseDataUrl?: string | null;
  poseMeshUrl?: string | null;
}

interface Props {
  durationSeconds: number;
  imageCount: number;
  tags: string[];
}

type Phase = "idle" | "drawing" | "paused" | "done";

export function PracticeSessionClient({ durationSeconds, imageCount, tags }: Props) {
  const [current, setCurrent] = useState<SessionImage | null>(null);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const fetchNext = useCallback(async (): Promise<SessionImage | null> => {
    const params = new URLSearchParams();
    if (tags.length > 0) params.set("tags", tags.join(","));
    const res = await fetch(`/api/references/random?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as SessionImage;
  }, [tags]);

  const advance = useCallback(async () => {
    if (index + 1 >= imageCount) {
      setPhase("done");
      return;
    }
    let next: SessionImage | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      next = await fetchNext();
      if (!next) break;
      if (!seenIds.current.has(next.id)) break;
    }
    if (!next) {
      setError("No images available for these filters.");
      return;
    }
    seenIds.current.add(next.id);
    setCurrent(next);
    setIndex((i) => i + 1);
    setSecondsLeft(durationSeconds);
    setPhase("drawing");
  }, [durationSeconds, fetchNext, imageCount, index]);

  useEffect(() => {
    if (phase !== "idle") return;
    void (async () => {
      const first = await fetchNext();
      if (!first) {
        setError("No images available for these filters.");
        return;
      }
      seenIds.current.add(first.id);
      setCurrent(first);
      setIndex(1);
      setSecondsLeft(durationSeconds);
      setPhase("drawing");
    })();
  }, [durationSeconds, fetchNext, phase]);

  useEffect(() => {
    if (phase !== "drawing") return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          void advance();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, advance]);

  if (error) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-destructive">{error}</p>
        <Link href="/practice" className="text-sm underline">
          Back to setup
        </Link>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold">Session complete</h1>
        <p className="text-muted-foreground">
          {imageCount} image{imageCount === 1 ? "" : "s"} at {durationSeconds}s each.
        </p>
        <div className="flex justify-center gap-2">
          <Link
            href="/practice"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Start another
          </Link>
          <Link
            href="/library"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-secondary"
          >
            Browse library
          </Link>
        </div>
      </div>
    );
  }

  if (!current) {
    return <p>Loading next image…</p>;
  }

  const pct = Math.round((secondsLeft / durationSeconds) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span>
          Image <strong>{index}</strong> / {imageCount}
        </span>
        <span className="font-mono text-lg" aria-live="polite">
          {secondsLeft}s
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPhase((p) => (p === "drawing" ? "paused" : "drawing"))}
          >
            {phase === "drawing" ? "Pause" : "Resume"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void advance()}>
            Skip
          </Button>
        </div>
      </div>
      <div className="h-1 w-full overflow-hidden rounded bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      <PoseAnalyzer
        src={current.url}
        alt={current.title ?? current.filename}
        resetKey={current.id}
        poseDataUrl={current.poseDataUrl}
        poseMeshUrl={current.poseMeshUrl}
        className="mx-auto max-w-3xl"
      />
      <p className="text-center text-xs text-muted-foreground">
        {current.folderPath || "(root)"} · {current.filename}
      </p>
    </div>
  );
}
