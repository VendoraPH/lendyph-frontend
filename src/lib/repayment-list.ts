// Repayments as the screens hold them: one loan's, as its ledger reads them,
// and one member's, as the Payments tab counts them.
//
// Split out of the pages so the parts that were wrong can be tested without a
// browser. Both lists used to be one page of `GET /loans/{loan}/repayments`:
// the endpoint's default 15, and the OLDEST 15, so every loan past its
// fifteenth payment silently lost its newest.
//
// Type-only imports, so it runs under `tsx --test`.

import type { DrainResult } from "@/lib/paginate";
import type { Payment, Repayment } from "@/types";

/** Set only when a drain gave up with pages outstanding. Null means complete. */
export interface RepaymentListShortfall {
  /** How many payments the screen actually has in hand. */
  shown: number;
  /** `meta.total` — how many exist. Null when the response carried no usable total. */
  total: number | null;
}

function shortfallOf(drain: DrainResult<unknown>): RepaymentListShortfall | null {
  return drain.truncated ? { shown: drain.rows.length, total: drain.total } : null;
}

/** A row as it arrives: the typed fields plus the aliases `RepaymentResource` sends beside them. */
type WireRepayment = Repayment & Record<string, unknown>;

/**
 * A list row with the four fields the ledger reads, from the aliases the row
 * already carries.
 *
 * `principal_paid`, `interest_paid` and `penalty_paid` exist on no endpoint;
 * every row carries the allocation as `principal_amount`, `interest_amount`
 * and `penalty_amount` instead, and this is the fallback mapping the ledger
 * has always used. A zero reads as "not recorded" (`undefined`), which the
 * ledger renders as a dash rather than ₱0.00. No endpoint serves an SCB split
 * either, so `scb_paid` stays blank until one does.
 *
 * There is deliberately no per-row request behind this. The page used to ask
 * `GET /repayments/{id}` for every payment on the belief that the list omits
 * the breakdown and the detail includes it — but both serialise the same
 * `RepaymentResource` over the same eager loads (the backend now pins that
 * with a parity test), so each of those requests returned the row it started
 * from. Drained, they would have been one request per payment on every page
 * view, against a shared budget of 60 a minute per user.
 */
export function withBreakdown(row: Repayment): Repayment {
  const r = row as WireRepayment;
  return {
    ...row,
    principal_paid: (r.principal_paid ?? (r.principal_amount as number)) || undefined,
    interest_paid: (r.interest_paid ?? (r.interest_amount as number)) || undefined,
    scb_paid: (r.scb_paid ?? (r.scb_amount as number)) || undefined,
    penalty_paid: (r.penalty_paid ?? (r.penalty_amount as number)) || undefined,
  };
}

export interface LoanRepayments {
  rows: Repayment[];
  shortfall: RepaymentListShortfall | null;
}

/**
 * A loan's drained repayments as its ledger reads them, and whether that is
 * all of them.
 *
 * Takes the whole `DrainResult`, not `rows`, so it cannot be called in a way
 * that drops `truncated` — the same reason `toShareCapitalBalance()` does.
 */
export function toLoanRepayments(drain: DrainResult<Repayment>): LoanRepayments {
  return { rows: drain.rows.map(withBreakdown), shortfall: shortfallOf(drain) };
}

export interface BorrowerPayments {
  payments: Payment[];
  shortfall: RepaymentListShortfall | null;
}

/**
 * A member's payments across all their loans, and whether that is all of them.
 *
 * `Payment` is the Payments tab's view of the same `RepaymentResource` row — it
 * reads the `amount` and `paid_at` aliases the resource sends beside
 * `amount_paid` and `payment_date` — so the rows pass through unchanged.
 */
export function toBorrowerPayments(drain: DrainResult<Repayment>): BorrowerPayments {
  return {
    payments: drain.rows as unknown as Payment[],
    shortfall: shortfallOf(drain),
  };
}
