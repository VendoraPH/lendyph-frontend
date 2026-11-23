/**
 * The online applications dashboard's tiles (`GET /loan-origination/dashboard`).
 * Every figure is the server's: money as its two-decimal strings, rates and
 * hours to the one decimal it rounded them to. The previous period's figure
 * and its change (`changes`, LO-B5) are shown as the server sent them; no
 * change is worked out in the browser.
 */

import { formatCurrency } from "@/lib/format";
import { STATUS_LABELS, formatDuration } from "@/lib/loan-origination";
import type { OriginationDashboard, OriginationKpis, OriginationTurnaround } from "@/types/loan-origination";
import { changeText } from "../../../dashboard/_lib/executive-overview";
import { padDecimals } from "./server-number";
import { words } from "./words";

export type KpiKind = "count" | "money" | "percent" | "hours";

export const KPI_TILES: readonly { key: keyof OriginationKpis; label: string; kind: KpiKind }[] = [
  { key: "total", label: "Applications started", kind: "count" },
  { key: "new", label: "Submitted in the period", kind: "count" },
  { key: "incomplete", label: "Not submitted yet", kind: "count" },
  { key: "submitted", label: "Submitted, not yet reviewed", kind: "count" },
  { key: "pending_documents", label: "Under document verification", kind: "count" },
  { key: "additional_info_required", label: "Additional information required", kind: "count" },
  { key: "under_assessment", label: "Under assessment", kind: "count" },
  { key: "pending_approval", label: "For approval", kind: "count" },
  { key: "approved", label: "Approved", kind: "count" },
  { key: "converted", label: "Converted to loan", kind: "count" },
  { key: "rejected", label: "Rejected", kind: "count" },
  { key: "withdrawn", label: "Withdrawn", kind: "count" },
  { key: "expired", label: "Expired", kind: "count" },
  { key: "amount_requested", label: "Amount requested", kind: "money" },
  { key: "amount_approved", label: "Amount approved", kind: "money" },
  { key: "avg_processing_hours", label: "Average processing time", kind: "hours" },
  { key: "completion_rate", label: "Completion rate", kind: "percent" },
  { key: "approval_rate", label: "Approval rate", kind: "percent" },
];

const countFmt = new Intl.NumberFormat("en-PH");

/** A tile's figure as the server sent it; a dash when it sent none. */
export function kpiText(value: number | string | null | undefined, kind: KpiKind): string {
  if (value === null || value === undefined) return "—";
  if (kind === "money") return formatCurrency(value);
  if (typeof value !== "number") return "—";
  if (kind === "percent") return `${value}%`;
  if (kind === "hours") return formatDuration(value);
  return countFmt.format(value);
}

export function previousText(value: number | string | null | undefined, kind: KpiKind): string {
  return `Previous period: ${kpiText(value, kind)}`;
}

/**
 * A KPI's change as the server worked it out, in the executive dashboard's
 * format ("+12.5% vs previous period", "−3.00 pts vs previous period"); null
 * when it sent none, which shows nothing, as on the executive dashboard.
 */
export function kpiChange(changes: OriginationDashboard["changes"], key: keyof OriginationKpis): string | null {
  const change = changes?.[key];
  const text = change ? changeText(change.change, change.change_unit) : null;
  return text === null ? null : `${text} vs previous period`;
}

const STRETCHES: readonly [keyof OriginationTurnaround, string][] = [
  ["submitted_to_approved", "Submitted to approved"],
  ["approved_to_released", "Approved to released"],
  ["submitted_to_released", "Submitted to released"],
];

const days = (value: number | null) => (value === null ? "—" : `${padDecimals(value, 1)} days`);

const loans = (count: number) => (count === 0 ? "No loans" : `${countFmt.format(count)} ${count === 1 ? "loan" : "loans"}`);

/**
 * The server's turnaround on the loans the applications became, each stretch
 * in words with its average and median days as sent (one decimal), the loans
 * measured, and those with no start to measure from.
 */
export function turnaroundRows(turnaround: OriginationTurnaround) {
  return STRETCHES.map(([key, label]) => {
    const stretch = turnaround[key];
    return {
      key,
      label,
      average: days(stretch.average_days),
      median: days(stretch.median_days),
      loans: loans(stretch.loans),
      note:
        stretch.not_measured > 0
          ? `${stretch.not_measured} ${stretch.not_measured === 1 ? "loan had" : "loans had"} no start to measure from.`
          : null,
    };
  });
}

/** A status in the module's words; a status the module has no words for still reads as words, never as its key. */
const statusLabel = (status: string) => STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? words(status);

/** "Applications by status": each row labelled from the module's words, whatever label came with it. */
export function statusChartRows(rows: OriginationDashboard["by_status"]): OriginationDashboard["by_status"] {
  return rows.map((r) => ({ ...r, label: statusLabel(r.status) }));
}

/** "Average time in each stage": each stage labelled from the module's words. */
export function stageChartRows(rows: OriginationDashboard["stage_times"]): OriginationDashboard["stage_times"] {
  return rows.map((r) => ({ ...r, label: statusLabel(r.status) }));
}
