import { toNumber } from "@/lib/report-format";

/** One sparkline point. `null` is a day the server has no figure for. */
export type SparklinePoint = { v: number | null };

/**
 * A GET /dashboard/stats sparkline series, ready to draw. The overdue series'
 * past points come from daily snapshots and a day without one is sent as
 * `v: null`: it stays `null`, a gap in the line, never 0, which would claim
 * nothing was overdue that day. A real 0 stays 0.
 */
export function sparklinePoints(series: unknown): SparklinePoint[] {
  if (!Array.isArray(series)) return [];
  return series.map((point) => ({
    v: toNumber((point as { v?: unknown } | null)?.v),
  }));
}

/** Draw a line only when at least one point is a real figure. */
export function hasSparklineData(points: SparklinePoint[]): boolean {
  return points.some((p) => p.v !== null);
}
