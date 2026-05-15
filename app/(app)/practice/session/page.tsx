import { Suspense } from "react";
import { PracticeSessionClient } from "./PracticeSessionClient";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    duration?: string;
    count?: string;
    tags?: string;
  }>;
}

export default async function PracticeSessionPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const duration = Math.max(5, Number.parseInt(params.duration ?? "60", 10) || 60);
  const count = Math.max(1, Math.min(100, Number.parseInt(params.count ?? "10", 10) || 10));
  const tags = params.tags ? params.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];

  return (
    <Suspense fallback={<p>Loading…</p>}>
      <PracticeSessionClient durationSeconds={duration} imageCount={count} tags={tags} />
    </Suspense>
  );
}
