import type { DashboardMonth } from "@/types";
import { centavosOrNull } from "./dashboard-figures";

/** One point of the dashboard's charts. Every figure is the server's, in centavos. */
export interface DashboardChartRow {
  /** "YYYY-MM", as sent. */
  month: string;
  /** "Nov", for the axis. */
  tick: string;
  /** "November 2026", for the tooltip. */
  label: string;
  income: number | null;
  expenses: number | null;
  net_income: number | null;
  cash: number | null;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-11" → ["2026", "November"], or null for anything else. */
function monthParts(month: string): [string, string] | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const name = MONTH_NAMES[Number(match[2]) - 1];
  return name ? [match[1], name] : null;
}

/** "2026-11" → "November 2026"; a value that isn't a month reads as sent. */
export function monthLabel(month: string): string {
  const parts = monthParts(month);
  return parts ? `${parts[1]} ${parts[0]}` : month;
}

/** "2026-11" → "Nov"; a value that isn't a month reads as sent. */
export function monthTick(month: string): string {
  const parts = monthParts(month);
  return parts ? parts[1].slice(0, 3) : month;
}

/**
 * The server's `months`, oldest first as sent, mapped field by field for the
 * charts. A figure the server didn't send stays null, so the chart leaves a gap
 * instead of drawing zero.
 */
export function dashboardChartRows(months: readonly DashboardMonth[] | null | undefined): DashboardChartRow[] {
  return (months ?? []).map((m) => ({
    month: m.month,
    tick: monthTick(m.month),
    label: monthLabel(m.month),
    income: centavosOrNull(m.income),
    expenses: centavosOrNull(m.expenses),
    net_income: centavosOrNull(m.net_income),
    cash: centavosOrNull(m.cash),
  }));
}

const COMPACT = new Intl.NumberFormat("en-PH", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * An axis tick, abbreviated on purpose ("₱130K"). Display only: tooltips and
 * tables show the full figure to the centavo.
 */
export function compactPesoTick(centavos: number): string {
  const sign = centavos < 0 ? "-" : "";
  return `${sign}₱${COMPACT.format(Math.abs(centavos) / 100)}`;
}
