import { cn } from "@/lib/utils";

/**
 * The server's readiness (a whole percent, 0 to 100) as a bar. Red while any
 * Critical issue is open, however high the figure; green at 100. The figure
 * and the issue count are the server's.
 */
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
  const bar = critical > 0 ? "bg-red-500" : value >= 100 ? "bg-emerald-500" : "bg-blue-500";
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500", bar)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
