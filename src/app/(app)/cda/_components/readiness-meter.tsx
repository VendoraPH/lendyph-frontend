import { cn } from "@/lib/utils";
import { clampPercent, readinessTone, type ReadinessTone } from "../_lib/readiness";

const BAR: Record<ReadinessTone, string> = {
  ready: "bg-emerald-500",
  progress: "bg-blue-500",
  blocked: "bg-red-500",
};

/** A readiness bar. Red while any Critical issue is open, however high the score. */
export function ReadinessMeter({
  value,
  critical = 0,
  label = "Readiness",
  className,
}: {
  value: number;
  critical?: number;
  label?: string;
  className?: string;
}) {
  const pct = clampPercent(value);
  const tone = readinessTone(pct, critical);
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{Math.round(pct)}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className={cn("h-full rounded-full transition-all", BAR[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
