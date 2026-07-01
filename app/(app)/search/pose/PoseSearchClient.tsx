"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, Search, User } from "lucide-react";
import type { ReferenceListItem } from "@/services/references";
import { detectPose } from "@/features/pose/lib/pose-landmarker";
import {
  buildFeatureVector,
  buildLimbMask,
  computeJointAngles,
  defaultStandingPose,
  featurizePose,
  type LimbGroup,
} from "@/features/pose/lib/pose-features";
import { drawStickFigure } from "@/features/pose/lib/draw-stick-figure";
import { LM } from "@/features/pose/lib/topology";
import type { Pose } from "@/features/pose/lib/types";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";

type SearchTab = "stickman" | "photo" | "text";

const DRAGGABLE_JOINTS = [
  LM.NOSE,
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_ELBOW,
  LM.RIGHT_ELBOW,
  LM.LEFT_WRIST,
  LM.RIGHT_WRIST,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_KNEE,
  LM.RIGHT_KNEE,
  LM.LEFT_ANKLE,
  LM.RIGHT_ANKLE,
] as const;

const LIMB_OPTIONS: { id: LimbGroup; label: string }[] = [
  { id: "leftArm", label: "Left arm" },
  { id: "rightArm", label: "Right arm" },
  { id: "leftLeg", label: "Left leg" },
  { id: "rightLeg", label: "Right leg" },
  { id: "torso", label: "Torso" },
  { id: "head", label: "Head" },
  { id: "archetype", label: "Whole pose" },
];

interface PoseSearchResponse {
  results: Array<{
    referenceId: string;
    score: number;
    item: ReferenceListItem | null;
  }>;
}

interface LlmSearchResponse extends PoseSearchResponse {
  parsedFilter: Record<string, string>;
  source: string;
}

function ResultCard({ item, score }: { item: ReferenceListItem; score: number }) {
  return (
    <Link
      href={`/library/${item.id}`}
      className="group block overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <div className="aspect-[3/4] overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.thumbnailUrl}
          alt={item.title ?? item.filename}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
      </div>
      <div className="p-2.5">
        <p className="line-clamp-1 text-xs font-medium">{item.title ?? item.filename}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Match {(score * 100).toFixed(0)}%
        </p>
      </div>
    </Link>
  );
}

export function PoseSearchClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tab, setTab] = useState<SearchTab>("stickman");
  const [pose, setPose] = useState<Pose>(() => defaultStandingPose());
  const [activeLimbs, setActiveLimbs] = useState<Set<LimbGroup>>(
    () => new Set(LIMB_OPTIONS.map((l) => l.id)),
  );
  const [results, setResults] = useState<PoseSearchResponse["results"]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textQuery, setTextQuery] = useState("");
  const [parsedFilter, setParsedFilter] = useState<Record<string, string> | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);
    drawStickFigure(ctx, pose, w, h, { boneWidth: 4, pointRadius: 8 });
  }, [pose]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const runVectorSearch = useCallback(
    async (targetPose: Pose) => {
      setLoading(true);
      setError(null);
      try {
        const angles = computeJointAngles(targetPose);
        const embedding = buildFeatureVector(angles, targetPose);
        const limbs = activeLimbs.size === LIMB_OPTIONS.length ? undefined : [...activeLimbs];
        const mask = buildLimbMask(limbs);
        const res = await fetch("/api/pose/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embedding: [...embedding],
            mask: [...mask],
          }),
        });
        if (!res.ok) throw new Error("Search failed");
        const data = (await res.json()) as PoseSearchResponse;
        setResults(data.results.filter((r) => r.item));
        setParsedFilter(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        setLoading(false);
      }
    },
    [activeLimbs],
  );

  const scheduleSearch = useCallback(
    (targetPose: Pose) => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => void runVectorSearch(targetPose), 400);
    },
    [runVectorSearch],
  );

  useEffect(() => {
    if (tab === "stickman") scheduleSearch(pose);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [pose, tab, scheduleSearch]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    let best = -1;
    let bestDist = 0.04;
    for (const idx of DRAGGABLE_JOINTS) {
      const p = pose[idx];
      if (!p) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = idx;
      }
    }
    if (best >= 0) {
      setDragging(best);
      canvas.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragging == null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / rect.height));
    setPose((prev) => {
      const next = [...prev];
      const p = next[dragging];
      if (p) next[dragging] = { ...p, x, y };
      return next;
    });
  };

  const handlePointerUp = () => setDragging(null);

  const toggleLimb = (limb: LimbGroup) => {
    setActiveLimbs((prev) => {
      const next = new Set(prev);
      if (next.has(limb)) next.delete(limb);
      else next.add(limb);
      return next;
    });
  };

  const handlePhotoUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });
      const result = await detectPose(img);
      URL.revokeObjectURL(url);
      const detected = result.landmarks?.[0] as Pose | undefined;
      if (!detected) throw new Error("No pose detected in image");
      const { embedding } = featurizePose(detected);
      const res = await fetch("/api/pose/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embedding: [...embedding] }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = (await res.json()) as PoseSearchResponse;
      setResults(data.results.filter((r) => r.item));
      setParsedFilter(null);
      setTab("photo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTextSearch = async () => {
    if (!textQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pose/search-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: textQuery.trim() }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = (await res.json()) as LlmSearchResponse;
      setResults(data.results.filter((r) => r.item));
      setParsedFilter(data.parsedFilter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      <div className="space-y-4">
        <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {(
            [
              { id: "stickman" as const, icon: User, label: "Stick figure" },
              { id: "photo" as const, icon: Camera, label: "Photo" },
              { id: "text" as const, icon: Search, label: "Describe" },
            ] as const
          ).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors ${
                tab === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === "stickman" ? (
          <Card className="overflow-hidden p-2">
            <canvas
              ref={canvasRef}
              width={320}
              height={480}
              className="mx-auto w-full max-w-[320px] cursor-crosshair touch-none rounded-lg"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Drag joints to shape the pose
            </p>
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Search focus</p>
              <div className="flex flex-wrap gap-1.5">
                {LIMB_OPTIONS.map((limb) => (
                  <button
                    key={limb.id}
                    type="button"
                    onClick={() => toggleLimb(limb.id)}
                    className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                      activeLimbs.has(limb.id)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {limb.label}
                  </button>
                ))}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => setPose(defaultStandingPose())}
            >
              Reset pose
            </Button>
          </Card>
        ) : null}

        {tab === "photo" ? (
          <Card className="p-4">
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed border-border p-8 transition-colors hover:border-primary/50 hover:bg-muted/30">
              <Camera className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Upload photo or drawing</span>
              <span className="text-xs text-muted-foreground">Pose will be detected automatically</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handlePhotoUpload(f);
                }}
              />
            </label>
          </Card>
        ) : null}

        {tab === "text" ? (
          <Card className="space-y-3 p-4">
            <textarea
              value={textQuery}
              onChange={(e) => setTextQuery(e.target.value)}
              placeholder='e.g. "arms up, sitting", "head down, left leg lifted"'
              className="min-h-[100px] w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleTextSearch();
                }
              }}
            />
            <Button type="button" className="w-full" onClick={() => void handleTextSearch()}>
              Search by description
            </Button>
          </Card>
        ) : null}

        {parsedFilter && Object.keys(parsedFilter).length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {Object.entries(parsedFilter).map(([k, v]) => (
              <Badge key={k} className="bg-secondary/50 text-[10px] text-foreground">
                {k}: {v}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-w-0 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Results</h2>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {results.length === 0 && !loading ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No matches yet. Run <code className="rounded bg-muted px-1">npm run pose:detect</code>{" "}
            and <code className="rounded bg-muted px-1">npm run pose:featurize</code> to index the
            library, then search again.
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {results.map((r) =>
              r.item ? (
                <ResultCard key={r.referenceId} item={r.item} score={r.score} />
              ) : null,
            )}
          </div>
        )}
      </div>
    </div>
  );
}
