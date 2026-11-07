/**
 * Savings & Deposits, staff side. The backend for these does not exist yet;
 * `docs/SAVINGS_BACKEND_HANDOFF.md` is the contract these shapes follow.
 *
 * Money arrives as numbers or Laravel `decimal:2` strings; read it through
 * `formatCurrency` or the savings module's `toAmount`.
 */

import type { PaginatedResponse } from "./api";

/** `regular` is a passbook savings account; `time_deposit` is placed for a fixed term. */
export type SavingsProductKind = "regular" | "time_deposit";

export type InterestPosting = "monthly" | "quarterly" | "semi_annual" | "annual";

export interface SavingsProduct {
  id: number;
  code: string;
  name: string;
  kind: SavingsProductKind;
  /** Percent per year, e.g. 2.5. */
  annual_interest_rate: number | string;
  interest_posting: InterestPosting;
  /** The least an account can be opened with. */
  minimum_opening_balance: number | string;
  /** A withdrawal may not take the balance below this. */
  maintaining_balance: number | string;
  /** Below this daily balance the account earns nothing for the day. */
  minimum_balance_for_interest: number | string;
  /** Days without a member transaction before the account turns dormant; null never. */
  dormant_after_days: number | null;
  /** Final tax withheld from credited interest, percent (e.g. 20). 0 where the cooperative is exempt. */
  withholding_tax_rate: number | string;
  /**
   * Time deposits only: the terms, in days, a placement may choose (e.g.
   * [30, 90, 180, 360]). One rate per product, so a cooperative with rates by
   * term sets up one product per rate. Null on regular products.
   */
  term_options_days: number[] | null;
  /** Time deposits only: percent per year paid instead when a placement is broken before maturity. */
  pretermination_rate: number | string | null;
  is_active: boolean;
  /** Open accounts (or running placements) on this product. A product with any cannot be deleted. */
  account_count?: number;
}

export type SavingsProductInput = Omit<SavingsProduct, "id" | "account_count">;

export type SavingsAccountStatus = "active" | "dormant" | "frozen" | "closed";

export interface SavingsAccount {
  id: number;
  account_number: string;
  borrower_id: number;
  borrower_name: string | null;
  borrower_code: string | null;
  branch_id: number | null;
  branch_name: string | null;
  product: { id: number; code: string; name: string; kind: SavingsProductKind };
  status: SavingsAccountStatus;
  /** Ledger balance. */
  balance: number | string;
  /** Held for pending withdrawals, loan holds, etc. Not withdrawable. */
  hold_amount: number | string;
  /** What a withdrawal can take now: balance − holds − maintaining balance, never below 0. Server-computed. */
  available_balance: number | string;
  /** Interest earned since the last posting, not yet credited. */
  accrued_interest: number | string;
  opened_at: string;
  closed_at: string | null;
  last_transaction_at: string | null;
}

/**
 * `GET /savings/accounts`: one page, `meta.stats` (accounts per status, over
 * the whole book) and `meta.totals` (over the rows matching the filters).
 */
export interface SavingsAccountsResponse extends PaginatedResponse<SavingsAccount> {
  meta: PaginatedResponse<SavingsAccount>["meta"] & {
    totals?: { account_count: number; total_balance: number | string };
  };
}

export type SavingsTransactionType =
  | "deposit"
  | "withdrawal"
  | "interest"
  | "withholding_tax"
  | "fee"
  | "adjustment"
  | "closing";

/** One ledger line. `credit` adds to the balance, `debit` takes from it; one of them is 0. */
export interface SavingsTransaction {
  id: number;
  account_id: number;
  date: string;
  type: SavingsTransactionType;
  reference: string | null;
  description: string | null;
  debit: number | string;
  credit: number | string;
  /** The balance after this line, in posting order (date, then id). */
  running_balance: number | string;
  payment_method: string | null;
  created_by_user?: { id: number; name: string } | null;
  created_at: string | null;
}

export interface OpenSavingsAccountInput {
  borrower_id: number;
  product_id: number;
  /** YYYY-MM-DD, Asia/Manila. */
  opened_at: string;
  initial_deposit: number;
  payment_method: string;
  reference?: string;
}

/** A deposit or a withdrawal. */
export interface SavingsTransactionInput {
  amount: number;
  /** YYYY-MM-DD, Asia/Manila. */
  date: string;
  payment_method: string;
  reference?: string;
  remarks?: string;
}

export interface CloseSavingsAccountInput {
  /** YYYY-MM-DD, Asia/Manila. */
  date: string;
  reason: string;
  /** How the remaining balance and accrued interest are paid out. */
  payout_method: string;
}

// ── Holds ──

export type SavingsHoldStatus = "active" | "released";

/**
 * Money set aside on an account: a pending withdrawal, a loan's collateral
 * hold, a garnishment. An active hold counts in `hold_amount` and comes off
 * `available_balance`; an account with an active hold cannot be closed.
 */
export interface SavingsHold {
  id: number;
  account_id: number;
  amount: number | string;
  reason: string;
  /** YYYY-MM-DD the hold took effect. */
  placed_at: string;
  /** YYYY-MM-DD the server lifts it on its own, or null to hold until released. */
  expires_on: string | null;
  status: SavingsHoldStatus;
  released_at: string | null;
  release_reason: string | null;
  created_by_user?: { id: number; name: string } | null;
  released_by_user?: { id: number; name: string } | null;
}

export interface PlaceSavingsHoldInput {
  amount: number;
  reason: string;
  /** YYYY-MM-DD, or omitted to hold until released. */
  expires_on?: string;
}

export interface ReleaseSavingsHoldInput {
  reason: string;
}

// ── Time deposits ──

export type TimeDepositStatus = "active" | "matured" | "withdrawn" | "rolled_over" | "preterminated";

/**
 * What happens at maturity. `payout` pays principal and net interest out;
 * `rollover_principal` places the principal again and pays the interest out;
 * `rollover_all` places principal plus net interest again.
 */
export type MaturityInstruction = "payout" | "rollover_principal" | "rollover_all";

export interface TimeDeposit {
  id: number;
  certificate_number: string;
  borrower_id: number;
  borrower_name: string | null;
  borrower_code: string | null;
  branch_id: number | null;
  branch_name: string | null;
  product: { id: number; code: string; name: string };
  principal: number | string;
  /** Percent per year, fixed at placement. */
  annual_interest_rate: number | string;
  /** Percent per year paid if broken early, fixed at placement. */
  pretermination_rate: number | string | null;
  term_days: number;
  placement_date: string;
  maturity_date: string;
  /** Server-computed at placement, for the full term. */
  gross_interest: number | string;
  withholding_tax: number | string;
  net_interest: number | string;
  /** principal + net_interest. */
  maturity_amount: number | string;
  maturity_instruction: MaturityInstruction;
  status: TimeDepositStatus;
  /** When it was paid out, rolled over or pre-terminated. */
  settled_at: string | null;
  /** What was paid to the member on settlement (0 for a full rollover). */
  settled_amount: number | string | null;
  /** The placement this one was rolled over from / into. */
  rolled_over_from_id: number | null;
  rolled_over_to_id: number | null;
  created_by_user?: { id: number; name: string } | null;
}

/**
 * `GET /savings/time-deposits`: one page, `meta.stats` (placements per status)
 * and `meta.totals` over the rows matching the filters.
 */
export interface TimeDepositsResponse extends PaginatedResponse<TimeDeposit> {
  meta: PaginatedResponse<TimeDeposit>["meta"] & {
    totals?: {
      count: number;
      total_principal: number | string;
      /** Active placements maturing in the next 30 days. */
      maturing_30_days: number;
    };
  };
}

export interface PlaceTimeDepositInput {
  borrower_id: number;
  product_id: number;
  principal: number;
  /** One of the product's `term_options_days`. */
  term_days: number;
  /** YYYY-MM-DD, Asia/Manila. */
  placement_date: string;
  maturity_instruction: MaturityInstruction;
  payment_method: string;
  reference?: string;
}

export interface SettleTimeDepositInput {
  /** YYYY-MM-DD, on or after the maturity date. */
  date: string;
  action: MaturityInstruction;
  /** How anything paid out leaves the cooperative. Ignored for `rollover_all`. */
  payout_method: string;
}

export interface PreterminateTimeDepositInput {
  /** YYYY-MM-DD, before the maturity date. */
  date: string;
  reason: string;
  payout_method: string;
}

/** `GET /savings/time-deposits/{id}/pretermination-quote?date=`: what breaking it on `date` pays. */
export interface PreterminationQuote {
  date: string;
  days_held: number;
  /** The rate applied: the placement's pre-termination rate. */
  rate: number | string;
  gross_interest: number | string;
  withholding_tax: number | string;
  /** Any penalty charged on top of the reduced rate. */
  penalty: number | string;
  /** principal + gross − tax − penalty. */
  payout: number | string;
}
