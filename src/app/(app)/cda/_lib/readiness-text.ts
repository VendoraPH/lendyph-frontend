import type { CdaReadinessBreakdown, CdaReportRow } from "@/types/cda";

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * The readiness card's line: the server's "N of M checks pass.", or, when the
 * breakdown came without its counts (a report that doesn't apply, such as ATIR
 * or ABR without a CTE), "Not applicable." with the server's reason.
 */
export function readinessSummary(
  breakdown: CdaReadinessBreakdown,
  report: Pick<CdaReportRow, "applicable" | "not_applicable_reason">,
): string {
  if (isCount(breakdown.passed) && isCount(breakdown.total)) {
    return `${breakdown.passed} of ${breakdown.total} checks pass.`;
  }
  const reason = report.applicable ? null : report.not_applicable_reason?.trim();
  return reason ? `Not applicable. ${reason}` : "Not applicable.";
}
