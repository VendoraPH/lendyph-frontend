import type { DailyDuesSummary } from "@/types";

export interface CollectionPieSlice {
  name: "Collected" | "Partial" | "Pending";
  value: number;
  color: string;
}

/** The pie's slices, straight from the server's summary. No arithmetic here. */
export function collectionPieSlices(summary: DailyDuesSummary | null): CollectionPieSlice[] {
  return [
    { name: "Collected", value: summary?.collected_in_full ?? 0, color: "#10b981" },
    { name: "Partial", value: summary?.partially_collected ?? 0, color: "#f59e0b" },
    { name: "Pending", value: summary?.uncollected ?? 0, color: "#94a3b8" },
  ];
}

/** The rate badge's colour band for the server's collection rate. */
export function collectionRateTone(rate: number | null): "good" | "fair" | "poor" | "unknown" {
  if (rate === null) return "unknown";
  if (rate >= 80) return "good";
  if (rate >= 50) return "fair";
  return "poor";
}
