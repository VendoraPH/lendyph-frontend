/**
 * The online applications dashboard's tiles (`GET /loan-origination/dashboard`).
 * Every figure is the server's: money as its two-decimal strings, rates and
 * hours to the one decimal it rounded them to. The previous period's figure
 * is shown as the server sent it; no change is worked out in the browser
 * (the server sends none yet).
 */

import { formatCurrency } from "@/lib/format";
import { formatDuration } from "@/lib/loan-origination";
import type { OriginationKpis } from "@/types/loan-origination";

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
