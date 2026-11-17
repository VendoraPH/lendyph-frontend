import { formatDateISO } from "@/lib/format";

/** The dashboard's reporting periods. Every range is inclusive, as YYYY-MM-DD. */
export type DashboardPreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "last_year"
  | "custom";

export interface Period {
  from: string;
  to: string;
}

export const DASHBOARD_PRESETS: { id: DashboardPreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_week", label: "This Week" },
  { id: "last_week", label: "Last Week" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "this_quarter", label: "This Quarter" },
  { id: "last_quarter", label: "Last Quarter" },
  { id: "this_year", label: "This Year" },
  { id: "last_year", label: "Last Year" },
  { id: "custom", label: "Custom" },
];

const DAY_MS = 86_400_000;

/** A YYYY-MM-DD string as a local-midnight Date (never `new Date(iso)`, which is UTC). */
export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

const iso = (y: number, m: number, d: number) => formatDateISO(new Date(y, m, d));

/**
 * The range a preset stands for, counted from `now`. Weeks start on Monday.
 * "This …" periods run to today, not to the end of the period: a figure for
 * days that have not happened yet would be a forecast. "Custom" keeps `fallback`.
 */
export function presetPeriod(preset: DashboardPreset, fallback: Period, now: Date = new Date()): Period {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const today = iso(y, m, d);
  const monday = d - ((now.getDay() + 6) % 7);
  const q = Math.floor(m / 3) * 3;
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: iso(y, m, d - 1), to: iso(y, m, d - 1) };
    case "this_week":
      return { from: iso(y, m, monday), to: today };
    case "last_week":
      return { from: iso(y, m, monday - 7), to: iso(y, m, monday - 1) };
    case "this_month":
      return { from: iso(y, m, 1), to: today };
    case "last_month":
      return { from: iso(y, m - 1, 1), to: iso(y, m, 0) };
    case "this_quarter":
      return { from: iso(y, q, 1), to: today };
    case "last_quarter":
      return { from: iso(y, q - 3, 1), to: iso(y, q, 0) };
    case "this_year":
      return { from: iso(y, 0, 1), to: today };
    case "last_year":
      return { from: iso(y - 1, 0, 1), to: iso(y - 1, 11, 31) };
    case "custom":
    default:
      return fallback;
  }
}

/** Inclusive length of a period in days; 0 for an unreadable or reversed one. */
export function periodDays(period: Period): number {
  const from = parseISODate(period.from);
  const to = parseISODate(period.to);
  if (!from || !to || to < from) return 0;
  // Rounded: a DST shift (not in Manila, but on a travelling laptop) moves midnight by an hour.
  return Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
}

/**
 * The comparison period: the same number of days ending the day before
 * `period` starts. A whole calendar month compares with the whole month
 * before it, whatever their lengths, so "Last Month" in March reads against
 * all of January rather than the last 28 days of it.
 */
export function previousPeriod(period: Period): Period | null {
  const from = parseISODate(period.from);
  const to = parseISODate(period.to);
  const days = periodDays(period);
  if (!from || !to || days === 0) return null;

  const wholeMonth =
    from.getDate() === 1 &&
    to.getMonth() === from.getMonth() &&
    to.getFullYear() === from.getFullYear() &&
    new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1).getDate() === 1;
  if (wholeMonth) {
    return { from: iso(from.getFullYear(), from.getMonth() - 1, 1), to: iso(from.getFullYear(), from.getMonth(), 0) };
  }

  const y = from.getFullYear();
  const m = from.getMonth();
  const d = from.getDate();
  return { from: iso(y, m, d - days), to: iso(y, m, d - 1) };
}

/** Whether a custom range can be sent: both dates readable and in order. */
export function isValidPeriod(period: Period): boolean {
  return periodDays(period) > 0;
}
