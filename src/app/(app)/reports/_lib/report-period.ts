import { formatDateISO } from "@/lib/format";
import type { DateRange } from "./types";

/** The period buttons above a report. */
export type Preset =
  | "today"
  | "yesterday"
  | "last_7"
  | "this_month"
  | "whole_month"
  | "last_month"
  | "ytd"
  | "custom";

export const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_7", label: "Last 7 Days" },
  { id: "this_month", label: "This Month" },
  { id: "whole_month", label: "Whole Month" },
  { id: "last_month", label: "Last Month" },
  { id: "ytd", label: "Year to Date" },
  { id: "custom", label: "Custom" },
];

/**
 * The range a period button stands for, counted from `now` (the computer's
 * clock unless a test passes one). "Custom" keeps `fallback`.
 *
 * Preset ranges are serialised with formatDateISO, which reads the Date's
 * *local* calendar parts. `toISOString()` used to shift every preset a day
 * earlier in Manila (UTC+8) — "Today" literally queried yesterday.
 */
export function presetRange(preset: Preset, fallback: DateRange, now: Date = new Date()): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (preset) {
    case "today": {
      const t = formatDateISO(new Date(y, m, d));
      return { from: t, to: t };
    }
    case "yesterday": {
      const t = formatDateISO(new Date(y, m, d - 1));
      return { from: t, to: t };
    }
    case "last_7":
      return {
        from: formatDateISO(new Date(y, m, d - 6)),
        to: formatDateISO(new Date(y, m, d)),
      };
    case "this_month":
      return {
        from: formatDateISO(new Date(y, m, 1)),
        to: formatDateISO(new Date(y, m, d)),
      };
    case "whole_month":
      return {
        from: formatDateISO(new Date(y, m, 1)),
        to: formatDateISO(new Date(y, m + 1, 0)),
      };
    case "last_month":
      return {
        from: formatDateISO(new Date(y, m - 1, 1)),
        to: formatDateISO(new Date(y, m, 0)),
      };
    case "ytd":
      return {
        from: formatDateISO(new Date(y, 0, 1)),
        to: formatDateISO(new Date(y, m, d)),
      };
    case "custom":
    default:
      return fallback;
  }
}
