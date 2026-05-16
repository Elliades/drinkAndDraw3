import { cn } from "@/lib/utils";
import type { AngleDelta } from "../lib/compare-pose";

interface JointChipProps {
  delta: AngleDelta;
}

const TONE: Record<AngleDelta["severity"], string> = {
  good: "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  warn: "border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-300",
  bad: "border-destructive bg-destructive/15 text-destructive",
};

export function JointChip({ delta }: JointChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
        TONE[delta.severity],
      )}
      title={`Reference ${delta.refDeg.toFixed(0)}° vs drawing ${delta.drwDeg.toFixed(0)}°`}
    >
      <span className="font-medium text-foreground">{delta.label}</span>
      <span className="font-semibold">{delta.diffDeg.toFixed(0)}°</span>
    </span>
  );
}
