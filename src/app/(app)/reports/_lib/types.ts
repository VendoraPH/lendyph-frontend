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
  | "due_past_due_list";

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
    };

export interface ReportDocument {
  reportId: ReportId;
  meta: {
    title: string;
    subtitle?: string;
    period?: string;
    generatedAt: string;
    org: string;
  };
  sections: ReportSection[];
}

export interface DateRange {
  from: string;
  to: string;
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
  build: (range: DateRange) => Promise<ReportDocument>;
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
