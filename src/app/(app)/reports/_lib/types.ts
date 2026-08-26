import type { LucideIcon } from "lucide-react";
import type { SubjectKind } from "@/components/common/subject-picker";
import type { FormattableColumn } from "@/lib/report-format";

export type ReportId =
  | "daily_collection"
  | "portfolio_summary"
  | "income_report"
  | "aging_report"
  | "borrower_report"
  | "disbursement_report"
  | "releases_list"
  | "repayments_list"
  | "due_past_due_list"
  | "statement_of_account"
  | "subsidiary_ledger"
  | "cash_flow"
  | "collection_efficiency"
  | "portfolio_by_product"
  | "share_capital"
  | "performance"
  | "provisioning";

export type ReportCategory =
  | "operations"
  | "portfolio"
  | "member"
  | "disbursement"
  | "financial"
  | "performance";

/**
 * Re-exported, not redeclared: `formatValue` in `@/lib/report-format` is what
 * gives each of these a meaning, and a second copy here could drift from the
 * switch that implements it.
 */
export type { ColumnFormat } from "@/lib/report-format";

/**
 * A column of a report table.
 *
 * `key`, `format` and `formatter` are the three fields `formatCell` reads, so
 * they come from `FormattableColumn`; `header`, `width` and `align` are
 * presentation and belong to the report document model.
 */
export interface ReportColumn extends FormattableColumn {
  header: string;
  width?: number;
  align?: "left" | "right" | "center";
}

export interface KpiItem {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative" | "neutral";
}

/** A labelled figure in a definition list — the header block of a statement. */
export interface FieldItem {
  label: string;
  value: string;
}

export type ReportSection =
  | {
      kind: "kpi_grid";
      title?: string;
      items: KpiItem[];
    }
  | {
      kind: "table";
      title?: string;
      columns: ReportColumn[];
      rows: Record<string, unknown>[];
      totals?: { column: string; label?: string; value: string }[];
      emptyText?: string;
    }
  | {
      kind: "note";
      text: string;
    }
  /**
   * Two-column label→value block. Statements of account and subsidiary ledgers
   * open with account particulars that are neither a KPI nor a table row.
   */
  | {
      kind: "fields";
      title?: string;
      items: FieldItem[];
    }
  /**
   * Sign-off block. A cooperative report is not a real report until someone
   * has put their name to it, so the roles travel with the document and are
   * rendered in the preview and every export alike.
   */
  | {
      kind: "signatures";
      roles: string[];
    };

/**
 * Presentation identity applied to a built document: who ran it, under what
 * logo, against which branch. Separated from the payload→document builders so
 * those stay pure and testable without a session.
 */
export interface ReportChrome {
  /**
   * Organization name for the letterhead. Left unset by the reports page,
   * which lets `applyChrome` resolve it from branding settings; supplied only
   * when a caller already holds a name (a preview, a test).
   */
  org?: string | null;
  logoUrl?: string | null;
  /** Same logo as a data URL, for exporters that must embed the bytes. */
  logoData?: string | null;
  preparedBy?: string | null;
  branchLabel?: string | null;
  reference?: string | null;
}

export interface ReportDocument {
  reportId: ReportId;
  meta: {
    title: string;
    subtitle?: string;
    period?: string;
    generatedAt: string;
    /**
     * The organization the report is issued by. Builders emit an empty string
     * — they are pure and have no branding to read — and `applyChrome()` fills
     * it from branding settings, falling back to `siteConfig.name`.
     */
    org: string;
    /** Organization logo, resolved from branding settings at generate time. */
    logoUrl?: string | null;
    /**
     * The logo as a data URL. PDF and DOCX have to embed image bytes rather
     * than reference a URL, and the fetch that produces this can be blocked by
     * CORS — so it is separate from `logoUrl`, and null means those two
     * exports simply lead with the organization name instead.
     */
    logoData?: string | null;
    /** Full name of the signed-in user who generated the report. */
    preparedBy?: string | null;
    /** Branch the figures are scoped to, or "All Branches". */
    branchLabel?: string | null;
    /** Human-quotable document reference, e.g. `AGE-20260806-1432`. */
    reference?: string | null;
  };
  sections: ReportSection[];
}

export interface DateRange {
  from: string;
  to: string;
}

/**
 * Widest reporting period the API accepts, in years.
 *
 * Mirrors `ReportController::MAX_SPAN_YEARS`. A wider range comes back as a
 * 422 attributed to whichever date field the caller sent, so the picker should
 * refuse it up front instead of letting someone press Generate and meet a
 * validation error. No preset can breach it — Year to Date is the widest — but
 * the two custom `<input type="date">` fields can.
 */
export const MAX_REPORT_SPAN_YEARS = 10;

/**
 * Parse a `YYYY-MM-DD` value as LOCAL calendar parts.
 *
 * `new Date("2016-01-01")` is parsed as UTC midnight, which in Manila (UTC+8)
 * is the 1st at 08:00 — the same off-by-a-day class of bug `presetRange` and
 * `buildReference` already document. Everything here stays local so a range
 * that is exactly ten years wide is judged the same way the user sees it.
 */
function parseLocalDate(value: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) return null;
  const date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * True when a range is wider than the API will accept.
 *
 * Measured exactly as the server measures it: an open end resolves to today,
 * and a reversed range is judged on its absolute span. An unparseable or empty
 * pair is not a violation — that is the request builder's problem, not this
 * guard's, and blocking Generate over a half-typed date would be worse than
 * the 422 it prevents.
 */
export function exceedsReportSpanCap(
  range: DateRange,
  today: Date = new Date()
): boolean {
  const from = range.from ? parseLocalDate(range.from) : null;
  const to = range.to ? parseLocalDate(range.to) : null;
  if (!from && !to) return false;

  const start = from ?? today;
  const end = to ?? today;
  const [lo, hi] = end < start ? [end, start] : [start, end];

  const cap = new Date(lo.getFullYear() + MAX_REPORT_SPAN_YEARS, lo.getMonth(), lo.getDate());
  return cap < hi;
}

/**
 * Reports that read a single loan or borrower need that id chosen before they
 * can run; the detail page renders the matching picker and blocks Generate
 * until one is set.
 *
 * The same union `<SubjectPicker>` accepts, taken from the component rather
 * than restated, so the report catalog and the picker cannot disagree about
 * what can be picked.
 */
export type ReportSubject = SubjectKind;

/** Everything the detail page can vary before asking a report to build. */
export interface ReportContext {
  range: DateRange;
  /** null = all branches. Only sent for endpoints that accept branch_id. */
  branchId?: number | null;
  /** The chosen loan or borrower id, for subject-scoped reports. */
  subjectId?: number | null;
}

export interface ReportDefinition {
  id: ReportId;
  title: string;
  description: string;
  category: ReportCategory;
  icon: LucideIcon;
  accent: {
    text: string;
    bg: string;
    ring: string;
  };
  /** Set when the API accepts `branch_id`, which enables the branch picker. */
  supportsBranch?: boolean;
  /** Set when the report is scoped to one loan or borrower. */
  subject?: ReportSubject;
  build: (ctx: ReportContext) => Promise<ReportDocument>;
}

export const CATEGORY_META: Record<
  ReportCategory,
  { label: string; description: string }
> = {
  operations: {
    label: "Daily Operations",
    description: "Day-to-day collections and activity",
  },
  portfolio: {
    label: "Portfolio Health",
    description: "Balance, aging, income, and risk",
  },
  member: {
    label: "Member Activity",
    description: "Borrower and repayment activity",
  },
  disbursement: {
    label: "Disbursement",
    description: "Loan releases and new originations",
  },
  financial: {
    label: "Financial",
    description: "Cash position, share capital, and loan loss provisioning",
  },
  performance: {
    label: "Performance",
    description: "Collection efficiency and account officer productivity",
  },
};
