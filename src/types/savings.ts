/**
 * Savings & Deposits, staff side. The backend for these does not exist yet;
 * `docs/SAVINGS_BACKEND_HANDOFF.md` is the contract these shapes follow.
 *
 * Money arrives as numbers or Laravel `decimal:2` strings; read it through
 * `formatCurrency` or the savings module's `toAmount`.
 */

import type { PaginatedResponse } from "./api";

/** `regular` is a passbook savings account; `time_deposit` is placed for a term (Part 2). */
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
  is_active: boolean;
  /** Open accounts on this product. A product with accounts cannot be deleted. */
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
