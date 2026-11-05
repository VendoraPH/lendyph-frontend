import type { Loan, PaginatedResponse } from "@/types";
import { currencyOrDash, toNumber } from "@/lib/report-format";
import { dueAmountCell, readAmountDueNow, type AmountDueNow } from "@/lib/payment-figures";

/**
 * The `status` value this screen sends.
 *
 * `active` is a virtual status the API expands server-side from
 * `Loan::ACTIVE_STATUSES` (`Loan::scopeForStatus()`), so the set of statuses
 * that counts as "active" is defined once, on the server, and this screen holds
 * no opinion about it. It used to hold one — a private four-entry set including
 * `current` and `past_due`, neither of which is a member of the `loans.status`
 * enum, so neither ever matched a row.
 *
 * Do NOT replace this with the expansion. Spelling the statuses out here would
 * work today and would be a copy that goes stale the day the set changes — it
 * already changed once.
 */
export const ACTIVE_STATUS = "active";

/**
 * GET /loans `view=summary`: rows without schedules. Draining full rows cost
 * 32 MB raw at 2,000 loans; a loan's full data loads only when it is selected.
 */
export const LOAN_SUMMARY_VIEW = "summary";

/** Rows per page, until the cashier picks another size. */
export const ACTIVE_LOANS_PER_PAGE = 25;

/** The page sizes on offer. The API clamps `per_page` to 100. */
export const ACTIVE_LOANS_PER_PAGE_OPTIONS = [25, 50, 100] as const;

/** How long typing has to pause before the server is asked. */
export const ACTIVE_LOAN_SEARCH_DEBOUNCE_MS = 300;

/**
 * The `search` to send for what was typed: trimmed, inner whitespace collapsed,
 * so an extra space doesn't ask the server for a different loan.
 */
export function normaliseLoanSearch(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** One page of the table: GET /loans with the search and page in hand. */
export function activeLoanListParams(request: {
  query: string;
  page: number;
  perPage: number;
}): Record<string, unknown> {
  return {
    status: ACTIVE_STATUS,
    view: LOAN_SUMMARY_VIEW,
    page: request.page,
    per_page: request.perPage,
    ...(request.query ? { search: request.query } : {}),
  };
}

/**
 * For the cards while a search is on. `meta.total` and `meta.totals` follow the
 * request's search, and the cards describe every active loan, so they need an
 * unsearched read of their own; its one row is not used.
 */
export function activeLoanCardParams(): Record<string, unknown> {
  return { status: ACTIVE_STATUS, view: LOAN_SUMMARY_VIEW, per_page: 1 };
}

/**
 * GET /loans `meta.totals`: the server's figures over every row matching the
 * request's filters, not over the page. `total_outstanding` is everything owed
 * (principal, interest, penalty and premium). Each is null when the server
 * did not send a readable figure, so the screen shows a dash rather than 0.
 */
export interface ActiveLoanTotals {
  total_outstanding: number | null;
  overdue_amount: number | null;
  overdue_count: number | null;
}

function pageMeta(response: unknown): PaginatedResponse<Loan>["meta"] | null {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return null;
  }
  const meta = (response as { meta?: unknown }).meta;
  return meta && typeof meta === "object"
    ? (meta as PaginatedResponse<Loan>["meta"])
    : null;
}

/** `meta.totals` out of a list response, or null when it carried none. */
export function readLoanListTotals(response: unknown): ActiveLoanTotals | null {
  const totals = (pageMeta(response) as { totals?: unknown } | null)?.totals;
  if (!totals || typeof totals !== "object" || Array.isArray(totals)) return null;
  const t = totals as Record<string, unknown>;
  return {
    total_outstanding: toNumber(t.total_outstanding),
    overdue_amount: toNumber(t.overdue_amount),
    overdue_count: toNumber(t.overdue_count),
  };
}

export interface ActiveLoanPage {
  rows: Loan[];
  /** `meta.total`: how many loans match the request. Null when it wasn't sent. */
  total: number | null;
  lastPage: number;
  /** The server's totals for the same filters. Null when it sent none. */
  totals: ActiveLoanTotals | null;
}

/** A page out of a paginator body, tolerating a missing `data` or `meta`. */
export function readActiveLoanPage(response: unknown): ActiveLoanPage {
  const data = (response as { data?: unknown } | null | undefined)?.data;
  const meta = pageMeta(response);
  const lastPage = meta?.last_page;
  return {
    rows: Array.isArray(data) ? (data as Loan[]) : [],
    // 0 is a real total: "this coop has no active loans".
    total: typeof meta?.total === "number" ? meta.total : null,
    lastPage: typeof lastPage === "number" && lastPage > 0 ? lastPage : 1,
    totals: readLoanListTotals(response),
  };
}

/**
 * The page to go to after an answer, or null to stay. A payment can settle the
 * only loan on the last page, which leaves the cashier past the end of the list.
 */
export function pageAfterEmptyAnswer(answer: {
  requested: number;
  lastPage: number;
  rowCount: number;
}): number | null {
  if (answer.rowCount > 0 || answer.requested <= answer.lastPage) return null;
  return answer.lastPage;
}

/**
 * One loan on this screen. The table fills from a summary row; the figures it
 * doesn't carry (rate, amount due now) stay null until the loan's full data
 * loads.
 */
export interface ActiveLoan {
  id: number;
  loan_account_number: string;
  application_number: string;
  borrower_name: string;
  borrower_id: number;
  loan_product_name: string;
  interest_rate: number | null;
  interest_type: "fixed" | "diminishing";
  /** Everything owed (principal, interest, penalty, premium); null when not sent. */
  total_outstanding: number | null;
  status: string;
  next_due_date: string;
  /** The next open period's amount, on summary rows; null when not sent. */
  next_due_amount: number | null;
  overdue_amount: number;
  /** The server's amount due now and its parts; null when it sent none. */
  amount_due_now: AmountDueNow | null;
}

/** The list row fields this screen reads that `Loan` does not declare. */
type LoanListRow = Loan & {
  total_outstanding?: number | string | null;
  next_due_amount?: number | string | null;
};

export function mapLoanToActiveLoan(loan: Loan): ActiveLoan {
  const l = loan as LoanListRow & Record<string, unknown>;
  // Upon-maturity loans have a single payment due at maturity, so the next due
  // date is the maturity date — never a monthly increment off the release date.
  const isUponMaturity =
    (l.frequency ?? l.payment_frequency) === "upon_maturity" ||
    (l.interest_method ?? l.interest_type) === "upon_maturity";
  const maturityDate = (l.maturity_date as string) || "";
  const interestType = l.interest_method ?? l.interest_type;
  return {
    id: l.id,
    loan_account_number: l.loan_account_number || `LN-${l.id}`,
    application_number: l.application_number || `LA-${l.id}`,
    borrower_name: l.borrower?.full_name ?? l.borrower?.name ?? l.borrower_name ?? "—",
    borrower_id: l.borrower?.id ?? l.borrower_id ?? 0,
    loan_product_name: l.loan_product?.name ?? l.loan_product_name ?? "—",
    interest_rate: toNumber(l.interest_rate),
    interest_type: (interestType === "upon_maturity" ? "fixed" : (interestType ?? "fixed")) as ActiveLoan["interest_type"],
    total_outstanding: toNumber(l.total_outstanding),
    status: l.status,
    next_due_date: isUponMaturity ? maturityDate || l.next_due_date || "" : l.next_due_date || "",
    next_due_amount: toNumber(l.next_due_amount),
    overdue_amount: (l.overdue_amount as number) || 0,
    amount_due_now: readAmountDueNow(l.amount_due_now),
  };
}

/**
 * The table's Due Amount: the server's amount due now when the row carries it
 * (the figure the dialog shows as Total Due), otherwise a summary row's
 * `next_due_amount`. A dash without either.
 */
export function activeLoanDueCell(loan: ActiveLoan): ReturnType<typeof dueAmountCell> {
  if (loan.amount_due_now !== null) return dueAmountCell(loan.amount_due_now);
  return {
    amount: currencyOrDash(loan.next_due_amount),
    penaltyNote: null,
    insuranceNote: null,
  };
}
