/**
 * The AMLA reports and dashboard counts (Phase 6, AMLA-B7):
 * lendyph-backend's `AmlaComplianceReportController`.
 */

/** One entry of `GET /amla/compliance-reports`: only the reports the caller may open. */
export interface AmlaComplianceReportSummary {
  key: string;
  title: string;
  description: string;
  /** False: the report is as of today and takes no date range. */
  uses_period: boolean;
  /** The report also needs head-office access (`branches:view_all`). */
  head_office: boolean;
}

export type AmlaReportColumnFormat = "text" | "number" | "money" | "date";

export interface AmlaReportColumn {
  key: string;
  label: string;
  format: AmlaReportColumnFormat | string;
}

/** `GET /amla/compliance-reports/{report}`: every value already formatted by the server. */
export interface AmlaComplianceReport {
  key: string;
  title: string;
  /** "Nov 1, 2026 to Nov 21, 2026", or "As of Nov 21, 2026". */
  period: string;
  /** The period hasn't ended, so its figures can still change. */
  draft: boolean;
  columns: AmlaReportColumn[];
  rows: Record<string, string>[];
  totals: Record<string, string> | null;
}

export type AmlaExportFormat = "pdf" | "xlsx" | "csv";

/** `POST /amla/compliance-reports/{report}/exports` (201). */
export interface AmlaReportExport {
  id: number;
  format: AmlaExportFormat;
  is_draft: boolean;
  rows: number;
  /** A signed link bound to the caller; it still needs the bearer token. */
  download_url: string;
}

export interface AmlaComplianceReportFilters {
  from: string;
  to: string;
  branch_id?: number;
}

/** `GET /amla/dashboard/counts`: a block is null when the caller lacks its key. */
export interface AmlaDashboardCounts {
  alerts: Record<string, number> | null;
  ctr_candidates: Record<string, number> | null;
  cases: Record<string, number> | null;
  filings: Record<string, number> | null;
  cdd: Record<string, number> | null;
}
