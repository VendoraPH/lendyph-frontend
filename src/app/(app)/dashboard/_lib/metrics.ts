/**
 * The executive dashboard's metric definitions: one place that says what each
 * figure is, how it is worked out, where it comes from and where it drills to.
 * Cards, tooltips and the export all read this, so a formula is never stated
 * twice. Pure, so it runs under `tsx --test`.
 */

import { formatCurrency } from "@/lib/format";
import type { Num } from "@/types/dashboard-reports";

/**
 * - `balance`: a position at a point in time (outstanding, share capital).
 * - `period`: a flow summed over the selected range (collections, releases).
 * - `ratio`: a percentage; its change is in percentage points.
 */
export type MetricKind = "balance" | "period" | "ratio";
export type MetricFormat = "currency" | "count" | "percent";

export interface MetricDefinition {
  label: string;
  kind: MetricKind;
  format: MetricFormat;
  /** Plain-language formula, shown in the card's tooltip and the export. */
  formula: string;
  /** The endpoint the figure is read from. */
  source: string;
  /** Where the card drills down to. */
  href: string;
  /** When higher is worse (PAR, past due), so the change is coloured the other way. */
  lowerIsBetter?: boolean;
}

export const METRICS = {
  outstanding_principal: {
    label: "Total Portfolio",
    kind: "balance",
    format: "currency",
    formula: "Unpaid principal of every released, ongoing and defaulted loan, as of today (the Dashboard's Total Portfolio).",
    source: "GET /reports/loan-balance-summary → outstanding_principal",
    href: "/reports/portfolio_summary",
  },
  total_outstanding: {
    label: "Outstanding",
    kind: "balance",
    format: "currency",
    formula: "Everything still owed (principal, interest, penalty and insurance premium) on released, ongoing and defaulted loans, as of today.",
    source: "GET /reports/loan-balance-summary → total_outstanding",
    href: "/reports/portfolio_summary",
  },
  active_loans: {
    label: "Active Loans",
    kind: "balance",
    format: "count",
    formula: "Number of released and ongoing loans, as of today. Defaulted loans are not counted.",
    source: "GET /reports/loan-balance-summary → active_loans",
    href: "/loans",
  },
  active_borrowers: {
    label: "Active Members",
    kind: "balance",
    format: "count",
    formula: "Members holding at least one active loan.",
    source: "GET /reports/borrowers → total_active_borrowers",
    href: "/reports/borrower_report",
  },
  loans_released: {
    label: "Loans Released",
    kind: "period",
    format: "currency",
    formula: "Principal of the loans released in the period, before deductions (the member received the net proceeds).",
    source: "GET /reports/cash-flow → non_cash.principal_released",
    href: "/reports/releases_list",
  },
  collections: {
    label: "Collections",
    kind: "period",
    format: "currency",
    formula:
      "All loan payments received in the period: principal, interest, penalty, insurance premium (held for the insurer) and overpayment.",
    source: "GET /reports/cash-flow → inflows.repayments.total",
    href: "/reports/cash_flow",
  },
  collection_rate: {
    label: "Collection Efficiency",
    kind: "ratio",
    format: "percent",
    formula: "Amount collected ÷ amount due in the period × 100.",
    source: "GET /reports/collection-efficiency → collection_rate",
    href: "/reports/collection_efficiency",
  },
  par30: {
    label: "Portfolio at Risk (PAR 30)",
    kind: "ratio",
    format: "percent",
    formula:
      "Unpaid principal of loans with an installment more than 30 days past its due date (grace not applied) ÷ total unpaid principal × 100, as of today.",
    source: "GET /reports/loan-balance-summary → par_ratio",
    href: "/reports/portfolio_by_product",
    lowerIsBetter: true,
  },
  past_due_amount: {
    label: "Past Due Amount",
    kind: "balance",
    format: "currency",
    formula: "Principal, interest and penalty of installments past their grace period, as of today: the Past Due Loans page's total.",
    source: "GET /reports/due-past-due?past_due_only=1 → totals.past_due_amount",
    href: "/loans/past-due",
    lowerIsBetter: true,
  },
  required_allowance: {
    label: "Required Loan Loss Provision",
    kind: "balance",
    format: "currency",
    formula: "Outstanding balance in each aging bucket × that bucket's provisioning rate, summed.",
    source: "GET /reports/provisioning → totals.required_allowance",
    href: "/reports/provisioning",
    lowerIsBetter: true,
  },
  share_capital: {
    label: "Share Capital",
    kind: "balance",
    format: "currency",
    formula: "Share capital at the end of the period: opening balance + credits − debits.",
    source: "GET /reports/share-capital → closing_balance",
    href: "/reports/share_capital",
  },
  net_income: {
    label: "Net Income",
    kind: "period",
    format: "currency",
    formula: "Posted income − posted expenses in the general ledger for the period.",
    source: "GET /accounting/dashboard → period.net_income",
    href: "/accounting",
  },
} as const satisfies Record<string, MetricDefinition>;

export type MetricId = keyof typeof METRICS;

/** The Executive Overview cards, in order. */
export const OVERVIEW_METRICS: MetricId[] = [
  "outstanding_principal",
  "total_outstanding",
  "active_loans",
  "active_borrowers",
  "loans_released",
  "collections",
  "collection_rate",
  "par30",
  "past_due_amount",
  "required_allowance",
  "share_capital",
  "net_income",
];

/** What a card shows when a figure could not be read. Never a zero. */
export const DATA_UNAVAILABLE = "Data Unavailable";

/** A server figure as a number; `null` when it is absent or unreadable, never 0. */
export function toNumber(value: Num): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Change against the previous period, in percent. Undefined (`null`) when
 * there is nothing to compare: either figure missing, or a previous figure of
 * zero, where any change is "infinite" and a percentage would mislead.
 */
export function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Change of a ratio, in percentage points. */
export function pointChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}

export type ChangeTone = "good" | "bad" | "flat";

/** Whether a change is good news, given which way the metric should move. */
export function changeTone(change: number | null, lowerIsBetter = false): ChangeTone {
  if (change === null || Math.abs(change) < 0.05) return "flat";
  return change > 0 !== lowerIsBetter ? "good" : "bad";
}

const COUNT = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });
const COMPACT = new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 });

/** An abbreviated peso tile ("₱1.3M"); below ₱1,000 the figure is shown in full. */
export function compactPeso(amount: number): string {
  if (Math.abs(amount) < 1_000) return formatCurrency(amount);
  return `${amount < 0 ? "-" : ""}₱${COMPACT.format(Math.abs(amount))}`;
}

/** A metric value for display; `compact` abbreviates pesos for a tile. */
export function formatMetric(value: number | null, format: MetricFormat, compact = false): string {
  if (value === null) return DATA_UNAVAILABLE;
  switch (format) {
    case "currency":
      return compact ? compactPeso(value) : formatCurrency(value);
    case "count":
      return COUNT.format(value);
    case "percent":
      return `${value.toFixed(2)}%`;
  }
}

/** "+4.2%" / "−1.10 pts"; `null` when there is no comparison. */
export function formatChange(change: number | null, kind: MetricKind): string | null {
  if (change === null) return null;
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  const size = Math.abs(change);
  return kind === "ratio" ? `${sign}${size.toFixed(2)} pts` : `${sign}${size.toFixed(1)}%`;
}
