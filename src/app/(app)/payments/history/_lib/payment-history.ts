/**
 * Payment History's money: the summary cards and each payment's amount.
 *
 * Every figure here is the server's. The cards show `meta.totals` from
 * `GET /repayments` (summed in SQL over the page's search and date range); a
 * row shows `amount_paid`, which already includes the penalty and any
 * insurance premium the payment collected, so those are notes inside the
 * amount and never added to it.
 */
import { formatCurrency } from "@/lib/format";
import type { RepaymentListTotals } from "@/types/repayment";

export interface PaymentHistoryFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
}

/**
 * What the totals request sends: the page's search and date range, never its
 * status tab (the server splits the totals by status itself). One row is
 * enough; only `meta.totals` is read.
 */
export function paymentTotalsParams(filters: PaymentHistoryFilters): Record<string, string | number> {
  const params: Record<string, string | number> = { per_page: 1 };
  const search = filters.search.trim();
  if (search) params.search = search;
  if (filters.dateFrom) params.date_from = filters.dateFrom;
  if (filters.dateTo) params.date_to = filters.dateTo;
  return params;
}

export interface PaymentTotals {
  collected: number | null;
  voided: number | null;
}

const DECIMAL = /^-?\d+(?:\.\d+)?$/;

/** A server figure as a number, or null when it is absent or not a figure. */
function serverFigure(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && DECIMAL.test(value.trim())) return Number(value);
  return null;
}

/** `meta.totals` from a `GET /repayments` body; null for what wasn't sent. */
export function readPaymentTotals(body: unknown): PaymentTotals {
  const totals = (body as { meta?: { totals?: RepaymentListTotals } } | null)?.meta?.totals;
  return {
    collected: serverFigure(totals?.collected),
    voided: serverFigure(totals?.voided),
  };
}

/** A card's figure: the server's, or a dash while loading or when absent. */
export function totalFigure(value: number | null | undefined): string {
  return value == null ? "—" : formatCurrency(value);
}

export interface PaymentAmountRow {
  amount: number;
  penalty_amount: number;
}

/** A payment's amount (`amount_paid`) and the penalty note inside it. */
export function paymentAmountFigures(row: PaymentAmountRow): { amount: string; penaltyNote: string | null } {
  return {
    amount: formatCurrency(row.amount),
    penaltyNote: row.penalty_amount > 0 ? `incl. ${formatCurrency(row.penalty_amount)} penalty` : null,
  };
}
