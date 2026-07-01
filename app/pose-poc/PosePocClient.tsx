"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { PoseAnalyzer } from "@/features/pose/components/PoseAnalyzer";

interface PocCase {
  id: string;
  label: string;
  imageUrl: string;
  poseDataUrl: string;
  poseMeshUrl?: string;
}

export function PosePocClient() {
  const [cases, setCases] = useState<PocCase[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/pose-poc/manifest.json")
      .then((r) => {
        if (!r.ok) throw new Error(`manifest HTTP ${r.status}`);
        return r.json() as Promise<PocCase[]>;
      })
      .then((items) => {
        if (cancelled) return;
        setCases(items);
        setActiveId(items[0]?.id ?? null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const active = cases.find((c) => c.id === activeId) ?? cases[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 space-y-2 border-b border-border pb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          Temporary POC
        </p>
        <h1 className="font-display text-2xl font-bold">SMPL pose validation</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Three fixed reference photos with precomputed NLF output. Toggle{" "}
          <strong className="font-medium text-foreground">2D stick</strong>,{" "}
          <strong className="font-medium text-foreground">3D mesh</strong> (body from
          the image), <strong className="font-medium text-foreground">3D anatomy</strong>,
          and <strong className="font-medium text-foreground">3D stick</strong> independently.
          Run <code className="text-xs">npm run pose-poc:prepare</code> with{" "}
          <code className="text-xs">--mesh</code> for the GLB layer.
        </p>
        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Could not load manifest: {error}. Run{" "}
            <code className="text-xs">npm run pose-poc:prepare</code> on the GPU
            machine first.
          </p>
        )}
      </header>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading manifest…</p>
      )}

      {!loading && cases.length > 0 && (
        <>
          <div
            className="mb-4 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Test images"
          >
            {cases.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={c.id === active?.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-left text-sm transition-colors",
                  c.id === active?.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          {active && (
            <PoseAnalyzer
              key={active.id}
              src={active.imageUrl}
              alt={active.label}
              poseDataUrl={active.poseDataUrl}
              poseMeshUrl={active.poseMeshUrl}
              resetKey={active.id}
            />
          )}
        </>
      )}
    </div>
  );
}
