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

/**
 * Whether the point at `index` is a real figure with no real figure on either
 * side. The line has no segment to draw there, so it gets a dot of its own;
 * without one a lone point (today's, before any snapshot exists) shows nothing.
 */
export function isIsolatedPoint(points: SparklinePoint[], index: number): boolean {
  if (points[index]?.v == null) return false;
  return (points[index - 1]?.v ?? null) === null && (points[index + 1]?.v ?? null) === null;
}
