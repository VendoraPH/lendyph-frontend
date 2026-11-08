/**
 * Payment History's money: the summary cards and each payment's amount.
 *
 * Every figure here is the server's. The cards show `meta.totals` from
 * `GET /repayments` (summed in SQL over the search and date range, split by
 * status whichever tab is open), and the count shows `meta.total`; a
 * row shows `amount_paid`, which already includes the penalty and any
 * insurance premium the payment collected, so those are notes inside the
 * amount and never added to it.
 */
import { normaliseSearchQuery } from "@/hooks/use-search-page";
import { formatCurrency } from "@/lib/format";
import { repaymentInsuranceApplied } from "@/lib/insurance-premium";
import { withoutLegacyPaymentMeta } from "@/lib/printables/legacy-remarks";
import { personName } from "@/lib/printables/templates/shared";
import type { RepaymentListTotals } from "@/types/repayment";

/** Rows per page of the payment list. */
export const PAYMENT_PAGE_SIZE = 25;

export interface PaymentHistoryFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
}

export interface PaymentListQuery extends PaymentHistoryFilters {
  /** The status tab: all, completed or voided. */
  status: string;
  page: number;
}

/** The server's value for each status tab. "All" sends none. */
const TAB_STATUS: Record<string, string> = { completed: "posted", voided: "voided" };

/** What `GET /repayments` is asked: one page, with every filter on the server. */
export function paymentListParams(query: PaymentListQuery): Record<string, string | number> {
  const params: Record<string, string | number> = { page: query.page, per_page: PAYMENT_PAGE_SIZE };
  const search = normaliseSearchQuery(query.search);
  if (search) params.search = search;
  if (query.dateFrom) params.date_from = query.dateFrom;
  if (query.dateTo) params.date_to = query.dateTo;
  const status = TAB_STATUS[query.status];
  if (status) params.status = status;
  return params;
}

/** Identifies one request. `reload` asks again for the same filters, as after a void. */
export function paymentListKey(params: Record<string, string | number>, reload: number): string {
  return `${JSON.stringify(params)}#${reload}`;
}

export interface PaymentTotals {
  collected: number | null;
  voided: number | null;
  /** Insurance premium the posted payments collected (part of `collected`). */
  insurance: number | null;
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
    insurance: serverFigure(totals?.total_insurance_applied),
  };
}

/** One answer from `GET /repayments`. Null for what the server didn't send. */
export interface PaymentPage<T> {
  /** The request it answers; see `paymentListKey`. */
  key: string;
  rows: T[];
  page: number | null;
  total: number | null;
  totals: PaymentTotals;
  stats: { posted: number; voided: number } | null;
}

interface PaymentListBody<T> {
  data?: T[];
  meta?: {
    current_page?: number;
    total?: number;
    stats?: Record<string, number>;
    totals?: RepaymentListTotals;
  };
}

export function readPaymentPage<T>(body: PaymentListBody<T> | null, key: string): PaymentPage<T> {
  const meta = body?.meta;
  return {
    key,
    rows: body?.data ?? [],
    page: meta?.current_page ?? null,
    total: meta?.total ?? null,
    totals: readPaymentTotals(body),
    stats: meta?.stats ? { posted: meta.stats.posted ?? 0, voided: meta.stats.voided ?? 0 } : null,
  };
}

/**
 * What the page shows for the request it wants. Until that answer arrives the
 * previous rows stay up, dimmed, but its figures read as a dash, so no card
 * describes filters other than the ones on screen.
 */
export function shownPaymentPage<T>(answer: PaymentPage<T> | null, key: string) {
  const settled = answer?.key === key;
  return {
    pending: !settled,
    rows: answer?.rows ?? [],
    totals: settled ? answer.totals : null,
    total: settled ? answer.total : null,
    stats: settled ? answer.stats : null,
  };
}

/**
 * The page to go back to when a page came back empty: a void or a filter can
 * leave it past the end. Always lower than `page`, so it can't loop on a
 * nonsense `last_page`. Null when this page stands.
 */
export function pageToStepBackTo(answer: { rows: number; page: number; lastPage?: number }): number | null {
  if (answer.rows > 0 || answer.page <= 1) return null;
  return Math.max(1, Math.min(answer.lastPage ?? 1, answer.page - 1));
}

/**
 * The line under the count. `meta.stats` ignores the search and dates, so it is
 * only true with neither set.
 */
export function paymentStatusBreakdown(
  stats: { posted: number; voided: number } | null,
  filters: PaymentHistoryFilters,
): string {
  if (!stats) return "";
  if (normaliseSearchQuery(filters.search) || filters.dateFrom || filters.dateTo) {
    return "Matching the search and dates";
  }
  return `${stats.posted} completed, ${stats.voided} voided`;
}

/** A card's figure: the server's, or a dash while loading or when absent. */
export function totalFigure(value: number | null | undefined): string {
  return value == null ? "—" : formatCurrency(value);
}

export interface PaymentAmountRow {
  amount: number;
  penalty_amount: number;
  insurance_applied?: number;
}

export interface PaymentAmountFigures {
  amount: string;
  penaltyNote: string | null;
  insuranceNote: string | null;
}

/**
 * A payment's amount (`amount_paid`) and the penalty and insurance premium
 * notes inside it.
 */
export function paymentAmountFigures(row: PaymentAmountRow): PaymentAmountFigures {
  const insurance = repaymentInsuranceApplied(row);
  return {
    amount: formatCurrency(row.amount),
    penaltyNote: row.penalty_amount > 0 ? `incl. ${formatCurrency(row.penalty_amount)} penalty` : null,
    insuranceNote: insurance === null ? null : `incl. ${formatCurrency(insurance)} insurance premium`,
  };
}

/**
 * Who voided a payment, by name. `voided_by` is the user's id and is never shown;
 * the name comes from `voided_by_user`, and a dash when that isn't there.
 */
export function voidedByName(row: Record<string, unknown>): string {
  return personName(row, "voided_by_user") ?? "—";
}

/** A row's remarks without the legacy method line; undefined when nothing's left. */
export function paymentRemarks(remarks: string | null | undefined): string | undefined {
  return withoutLegacyPaymentMeta(remarks) || undefined;
}
