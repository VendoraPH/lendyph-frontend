import type { LucideIcon } from "lucide-react";

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
  | "subsidiary_ledger";

export type ReportCategory =
  | "operations"
  | "portfolio"
  | "member"
  | "disbursement";

export type ColumnFormat =
  | "text"
  | "currency"
  | "number"
  | "percent"
  | "date"
  | "datetime";

export interface ReportColumn {
  key: string;
  header: string;
  width?: number;
  align?: "left" | "right" | "center";
  format?: ColumnFormat;
  formatter?: (value: unknown, row: Record<string, unknown>) => string;
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
 * Reports that read a single loan or borrower need that id chosen before they
 * can run; the detail page renders the matching picker and blocks Generate
 * until one is set.
 */
export type ReportSubject = "loan" | "borrower";

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
};
