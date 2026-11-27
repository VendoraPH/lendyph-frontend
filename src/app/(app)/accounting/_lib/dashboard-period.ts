import type { AccountingPeriodSummary } from "@/types";
import { formatDateRange } from "@/lib/report-format";
import { periodStatusLabel } from "./display-labels";

/** "November 2026 · Open", or that no period covers the As of date. */
export function currentPeriodText(period: AccountingPeriodSummary | null | undefined): string {
  if (!period) return "No accounting period covers this date";
  return `${period.name} · ${periodStatusLabel(period.status)}`;
}

/** The server's `period.from` to `period.to`, in words. */
export function periodRangeLabel(period: { from: string; to: string } | null | undefined): string {
  if (!period) return "";
  return formatDateRange(period.from, period.to);
}

/** The first day of As of's month: the server's own default for `from`. */
export function defaultDashboardFrom(asOf: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? `${asOf.slice(0, 7)}-01` : "";
}

/** Why the dates can't be sent (the server would answer 422), or null. */
export function dashboardFromError(from: string, asOf: string): string | null {
  if (!asOf) return "Choose an As of date.";
  if (!from) return "Choose a From date.";
  return from > asOf ? "From must be on or before As of." : null;
}
