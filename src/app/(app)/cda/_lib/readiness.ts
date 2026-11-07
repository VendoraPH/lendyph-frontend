import type { CdaReportSummary, CdaSeverity, CdaValidationIssue } from "@/types/cda";

/**
 * "Lendy CDA Readiness". The server's engine is authoritative and sends a
 * score per report; these helpers summarise what arrived, and must not invent
 * a score the server did not send.
 */

export const SEVERITY_ORDER: Record<CdaSeverity, number> = { critical: 0, warning: 1, info: 2 };

export function countBySeverity(issues: CdaValidationIssue[]): Record<CdaSeverity, number> {
  const counts: Record<CdaSeverity, number> = { critical: 0, warning: 0, info: 0 };
  for (const issue of issues) counts[issue.severity] += 1;
  return counts;
}

/** Critical first, then warnings, then info; stable within a severity. */
export function sortIssues(issues: CdaValidationIssue[]): CdaValidationIssue[] {
  return [...issues].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/** Mean readiness of the reports that apply to this cooperative, rounded. */
export function overallReadiness(reports: CdaReportSummary[]): number {
  const applicable = reports.filter((r) => r.applicable);
  if (applicable.length === 0) return 0;
  const sum = applicable.reduce((acc, r) => acc + clampPercent(r.readiness), 0);
  return Math.round(sum / applicable.length);
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export type ReadinessTone = "ready" | "progress" | "blocked";

/** A Critical issue blocks however high the score; 100 with none is ready. */
export function readinessTone(readiness: number, criticalCount: number): ReadinessTone {
  if (criticalCount > 0) return "blocked";
  return clampPercent(readiness) >= 100 ? "ready" : "progress";
}
