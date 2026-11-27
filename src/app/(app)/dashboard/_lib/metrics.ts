/**
 * How the executive dashboard's sections show a server figure. Pure, so it
 * runs under `tsx --test`. The cards' labels, values and changes come from
 * `GET /dashboard/executive/overview` (`executive-overview.ts`).
 */

import { formatCurrency } from "@/lib/format";
import type { Num } from "@/types/dashboard-reports";

export type MetricFormat = "currency" | "count" | "percent";

/** What a card shows when a figure could not be read. Never a zero. */
export const DATA_UNAVAILABLE = "Data Unavailable";

/** A server figure as a number; `null` when it is absent or unreadable, never 0. */
export function toNumber(value: Num): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export type ChangeTone = "good" | "bad" | "flat";

/** Whether a change is good news, given which way the metric should move. */
export function changeTone(change: number | null, lowerIsBetter = false): ChangeTone {
  if (change === null || Math.abs(change) < 0.05) return "flat";
  return change > 0 !== lowerIsBetter ? "good" : "bad";
}

const COUNT = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });
const COMPACT = new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 });

/** An abbreviated peso tile ("₱1.3M"); below ₱1,000 the figure is shown in full. */
export function compactPeso(amount: number): string {
  if (Math.abs(amount) < 1_000) return formatCurrency(amount);
  return `${amount < 0 ? "-" : ""}₱${COMPACT.format(Math.abs(amount))}`;
}

/** A metric value for display; `compact` abbreviates pesos for a tile. */
export function formatMetric(value: number | null, format: MetricFormat, compact = false): string {
  if (value === null) return DATA_UNAVAILABLE;
  switch (format) {
    case "currency":
      return compact ? compactPeso(value) : formatCurrency(value);
    case "count":
      return COUNT.format(value);
    case "percent":
      return `${value.toFixed(2)}%`;
  }
}
