import { formatCurrency } from "@/lib/format";
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

/**
 * The server's collection rate, or null when there is nothing to rate: no
 * summary, or a day with nothing due (the server answers 0 then).
 */
export function shownCollectionRate(summary: DailyDuesSummary | null): number | null {
  if (!summary || !(summary.total_due > 0)) return null;
  return summary.collection_rate;
}

/** The rate badge's colour band for the server's collection rate. */
export function collectionRateTone(rate: number | null): "good" | "fair" | "poor" | "unknown" {
  if (rate === null) return "unknown";
  if (rate >= 80) return "good";
  if (rate >= 50) return "fair";
  return "poor";
}

/** Padding between slices, only when two or more are drawn: one slice draws a whole ring, with no notch. */
export function donutPaddingAngle(slices: CollectionPieSlice[]): number {
  return slices.filter((s) => s.value !== 0).length > 1 ? 3 : 0;
}

/**
 * Nothing is due today: the server's `total_due` is 0, or its answer carried
 * no summary. A request still loading, or one that failed, is never read as
 * nothing due.
 */
export function isNothingDue(summary: DailyDuesSummary | null, state: "loading" | "ready" | "error"): boolean {
  if (state !== "ready") return false;
  return !summary || !(summary.total_due > 0);
}

export interface CollectionBadge {
  text: string;
  tone: ReturnType<typeof collectionRateTone>;
  /** Up for a good rate, down for a poor one, none in between: never up for a poor rate. */
  arrow: "up" | "down" | null;
}

/** The card's top-right badge: today's rate as the server sent it, or "Nothing due today". */
export function collectionBadge(rate: number | null, nothingDue: boolean): CollectionBadge {
  if (nothingDue) return { text: "Nothing due today", tone: "unknown", arrow: null };
  const tone = collectionRateTone(rate);
  const arrow = tone === "good" ? "up" : tone === "poor" ? "down" : null;
  return { text: `${rate === null ? "—" : `${rate}%`} collected`, tone, arrow };
}

export interface TodaySummaryRow {
  key: "total_due" | "total_collected" | "collected_in_full" | "partially_collected" | "uncollected";
  label: string;
  /** The server's figure, as sent; null when there is no summary. */
  amount: number | null;
  /** ₱ to the centavo, or "—" for a missing figure (a zero is ₱0.00). */
  amountLabel: string;
  /** A small line under the label: the loan count, or what the figure holds. */
  detail: string | null;
}

const loans = (n: number, word = "loan") => `${n} ${n === 1 ? word : `${word}s`}`;

/**
 * The "Today" list under the ring: each row one figure of the server's
 * daily-dues summary, shown as sent (DashboardService::dailyDues). Nothing is
 * added, subtracted or divided here, counts included.
 *
 * - Due today: what the loans due today owe (`total_due`).
 * - Collected: principal and interest paid on them, capped at what is due;
 *   penalty never counts (`total_collected`).
 * - Collected in full: the due of loans paid in full (`collected_in_full`).
 * - Partly collected: what part-paid loans have paid (`partially_collected`).
 * - Not yet collected: everything still owed today (`uncollected`), the
 *   unpaid loans plus the rest of the part-paid ones; its count is the unpaid
 *   loans only, so the row says so.
 */
export function todaySummaryRows(summary: DailyDuesSummary | null): TodaySummaryRow[] {
  const row = (key: TodaySummaryRow["key"], label: string, detail: string | null): TodaySummaryRow => {
    const amount = summary ? summary[key] : null;
    return { key, label, amount, amountLabel: amount === null ? "—" : formatCurrency(amount), detail };
  };
  const counts = summary?.counts;
  return [
    row("total_due", "Due today", null),
    row("total_collected", "Collected", "Principal + interest"),
    row("collected_in_full", "Collected in full", counts ? loans(counts.collected) : null),
    row("partially_collected", "Partly collected", counts ? loans(counts.partial) : null),
    row(
      "uncollected",
      "Not yet collected",
      counts ? `${loans(counts.pending, "unpaid loan")}${counts.partial > 0 ? " + partial balances" : ""}` : null,
    ),
  ];
}
