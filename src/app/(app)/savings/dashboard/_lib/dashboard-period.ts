import { formatDateISO } from "@/lib/format";

/** The Savings task's dashboard periods (TASK 35). */
export type DashboardPreset = "today" | "this_week" | "this_month" | "this_year" | "custom";

export const DASHBOARD_PRESETS: ReadonlyArray<{ id: DashboardPreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "this_week", label: "This Week" },
  { id: "this_month", label: "This Month" },
  { id: "this_year", label: "This Year" },
  { id: "custom", label: "Custom" },
];

export interface DashboardPeriod {
  /** YYYY-MM-DD. */
  from: string;
  to: string;
}

/**
 * A preset's period, ending today. `today` is Manila's today as a picker date
 * (`todayDate()`), so its calendar parts are the app's day. A week starts on
 * Monday.
 */
export function presetPeriod(preset: Exclude<DashboardPreset, "custom">, today: Date): DashboardPeriod {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const to = formatDateISO(new Date(y, m, d));
  switch (preset) {
    case "today":
      return { from: to, to };
    case "this_week": {
      const sinceMonday = (today.getDay() + 6) % 7;
      return { from: formatDateISO(new Date(y, m, d - sinceMonday)), to };
    }
    case "this_month":
      return { from: formatDateISO(new Date(y, m, 1)), to };
    case "this_year":
      return { from: formatDateISO(new Date(y, 0, 1)), to };
  }
}

/** Why a custom period can't be asked for, in words, or null. Mirrors the server's own checks. */
export function periodError(period: DashboardPeriod, todayIso: string): string | null {
  if (!period.from || !period.to) return "Pick both a start and an end date.";
  if (period.to > todayIso) return "The end date can't be after today.";
  if (period.from > period.to) return "The start date can't be after the end date.";
  return null;
}
