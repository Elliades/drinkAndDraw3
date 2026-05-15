"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/ui/button";

const DURATION_PRESETS = [30, 60, 120, 300, 600];
const COUNT_PRESETS = [5, 10, 15, 20];

interface Props {
  tags: string[];
}

export function PracticeConfigForm({ tags }: Props) {
  const router = useRouter();
  const [duration, setDuration] = useState<number>(60);
  const [imageCount, setImageCount] = useState<number>(10);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const toggleTag = (t: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const handleStart = () => {
    const params = new URLSearchParams();
    params.set("duration", String(duration));
    params.set("count", String(imageCount));
    if (selectedTags.size > 0) params.set("tags", [...selectedTags].join(","));
    router.push(`/practice/session?${params.toString()}`);
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        handleStart();
      }}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Duration per image (seconds)</legend>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((d) => (
            <Button
              type="button"
              key={d}
              variant={duration === d ? "default" : "outline"}
              onClick={() => setDuration(d)}
            >
              {d < 60 ? `${d}s` : `${Math.floor(d / 60)}m${d % 60 ? ` ${d % 60}s` : ""}`}
            </Button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Number of images</legend>
        <div className="flex flex-wrap gap-2">
          {COUNT_PRESETS.map((c) => (
            <Button
              type="button"
              key={c}
              variant={imageCount === c ? "default" : "outline"}
              onClick={() => setImageCount(c)}
            >
              {c}
            </Button>
          ))}
        </div>
      </fieldset>

      {tags.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">
            Tags filter <span className="text-muted-foreground">(optional)</span>
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => {
              const active = selectedTags.has(t);
              return (
                <button
                  type="button"
                  key={t}
                  onClick={() => toggleTag(t)}
                  className={
                    "rounded-full border px-3 py-1 text-xs transition-colors " +
                    (active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-secondary-foreground hover:bg-accent")
                  }
                >
                  {t}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <Button type="submit" size="lg" className="w-full">
        Start session
      </Button>
    </form>
  );
}
