import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  value: number;
  reliable?: boolean;
}

export function ScoreBadge({ value, reliable = true }: ScoreBadgeProps) {
  const tier = value >= 80 ? "good" : value >= 60 ? "warn" : "bad";
  const tone = {
    good: "border-emerald-500 text-emerald-600 dark:text-emerald-400",
    warn: "border-amber-500 text-amber-600 dark:text-amber-400",
    bad: "border-destructive text-destructive",
  }[tier];

  return (
    <div
      className={cn(
        "inline-flex min-w-16 flex-col items-center justify-center rounded-md border bg-card px-3 py-1.5 leading-tight",
        tone,
      )}
      title={
        reliable
          ? "Higher means closer match"
          : "Comparison may be unreliable - some landmarks weren't visible in both images"
      }
    >
      <span className="text-lg font-semibold">{value}%</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        match
      </span>
    </div>
  );
}
