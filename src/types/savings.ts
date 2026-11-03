/**
 * Savings & Deposits (Phase 1) — the contract the screens are typed against.
 *
 * The backend for this module is not built yet; these shapes are the ones
 * `docs/SAVINGS_BACKEND_HANDOFF.md` asks it to send. Money arrives as the
 * decimal strings Laravel's `decimal:2` cast produces (rates as `decimal:6`),
 * and the screens never add rows up themselves: balances, running balances,
 * previous/new balances and totals are the server's.
 *
 * Phase 2 hooks are already in the shapes (`interest_method`, `posting_frequency`,
 * `day_count_basis`, an account's nullable `rate_override`) so tiered,
 * promotional and per-account rates can land without a reshape.
 */

/** A decimal string from the API ("1500.00"); numbers are tolerated. */
export type Money = string | number;

// ── Products ──

/** Phase 1 ships `daily_balance` only; the union grows in Phase 2. */
export type SavingsInterestMethod = "daily_balance";

export type SavingsPostingFrequency =
  | "monthly"
  | "quarterly"
  | "semi_annual"
  | "annual";

/** `365`: every year has 365 days. `actual`: 366 in a leap year. */
export type DayCountBasis = "365" | "actual";

export type SavingsProductStatus = "active" | "inactive";

export interface SavingsProduct {
  id: number;
  code: string;
  name: string;
  description: string | null;
  /** Institution-defined label, e.g. "Regular", "Junior". Free text. */
  product_type: string;
  min_initial_deposit: Money;
  min_maintaining_balance: Money;
  min_balance_to_earn_interest: Money;
  /** Annual rate in percent ("2.000000" = 2%). */
  interest_rate: Money;
  interest_method: SavingsInterestMethod;
  posting_frequency: SavingsPostingFrequency;
  allow_deposits: boolean;
  allow_withdrawals: boolean;
  allow_multiple_accounts: boolean;
  /** Optional per-transaction withdrawal cap; `null` = none. */
  max_withdrawal_amount: Money | null;
  status: SavingsProductStatus;
  /** Accounts opened on this product. A product with any cannot be deleted. */
  accounts_count?: number;
  /** The server's answer to "may this be deleted?" — never derived here. */
  can_delete?: boolean;
  created_at: string;
  updated_at: string;
  created_by?: { id: number; name: string } | null;
  updated_by?: { id: number; name: string } | null;
}

type InterestTerms = "interest_rate" | "interest_method" | "posting_frequency";

/**
 * The interest terms are optional: a user without `savings:settings` saves a
 * product without them, and the server keeps the current values (or its
 * defaults, on create).
 */
export type SavingsProductPayload = Omit<
  SavingsProduct,
  | "id"
  | "accounts_count"
  | "can_delete"
  | "created_at"
  | "updated_at"
  | "created_by"
  | "updated_by"
  | InterestTerms
> &
  Partial<Pick<SavingsProduct, InterestTerms>>;

/** One change to a product: who changed what, from what to what. */
export interface SavingsChangeLogEntry {
  id: number;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  remarks?: string | null;
  user: { id: number; name: string } | null;
  created_at: string;
}

// ── Module settings ──

export interface SavingsSettings {
  /** Account numbers: `{prefix}{branch?}{sequence padded}`. */
  account_number_prefix: string;
  account_number_include_branch: boolean;
  account_number_padding: number;
  day_count_basis: DayCountBasis;
  /** Reversals wait for a second user with `savings:approve`. */
  require_reversal_approval: boolean;
  /** Interest batches wait for approval before posting. */
  require_interest_approval: boolean;
  /** Whether a member who is not active may open an account. */
  allow_inactive_member_opening: boolean;
  /** Days without a customer transaction before an account turns dormant. */
  dormancy_days: number;
}

// ── Accounts ──

export type SavingsAccountStatus = "active" | "dormant" | "frozen" | "closed";

export interface SavingsMemberRef {
  id: number;
  borrower_code: string | null;
  full_name: string;
  contact_number?: string | null;
  email?: string | null;
  address?: string | null;
  status?: string | null;
}

export interface SavingsAccount {
  id: number;
  account_number: string;
  member: SavingsMemberRef;
  product: Pick<
    SavingsProduct,
    | "id"
    | "code"
    | "name"
    | "min_maintaining_balance"
    | "min_initial_deposit"
    | "allow_deposits"
    | "allow_withdrawals"
    | "max_withdrawal_amount"
  >;
  branch: { id: number; name: string } | null;
  status: SavingsAccountStatus;
  opened_at: string;
  closed_at?: string | null;
  initial_deposit: Money;
  /** Withdrawable now (ledger balance less holds). */
  available_balance: Money;
  ledger_balance: Money;
  /** Product rate unless `rate_override` (Phase 2) is set. */
  interest_rate: Money;
  rate_override?: Money | null;
  accrued_interest: Money | null;
  remarks: string | null;
  last_transaction_at?: string | null;
}

export interface OpenSavingsAccountPayload {
  borrower_id: number;
  savings_product_id: number;
  opened_at: string;
  initial_deposit: number;
  payment_method: SavingsPaymentMethod;
  reference_number?: string;
  remarks?: string;
}

export interface OpenSavingsAccountResult {
  account: SavingsAccount;
  /** The initial-deposit transaction, when one was posted. */
  transaction: SavingsTransaction | null;
}

export interface SavingsAccountStats {
  total: number;
  active: number;
  dormant: number;
  frozen: number;
  closed: number;
}

export interface SavingsStatusChange {
  id: number;
  from_status: SavingsAccountStatus | null;
  to_status: SavingsAccountStatus;
  reason: string;
  user: { id: number; name: string } | null;
  created_at: string;
}

/** What closing an account would settle, computed by the server. */
export interface SavingsClosingQuote {
  ledger_balance: Money;
  accrued_interest: Money;
  /** Pending (unapproved) transactions block closing. */
  pending_transactions: number;
  payout_amount: Money;
  can_close: boolean;
  blockers: string[];
}

// ── Transactions ──

export type SavingsTransactionType =
  | "opening_deposit"
  | "deposit"
  | "withdrawal"
  | "transfer_in"
  | "transfer_out"
  | "interest"
  | "closing_withdrawal"
  | "reversal";

export type SavingsTransactionStatus = "posted" | "pending_approval" | "reversed" | "rejected";

export type SavingsPaymentMethod = "cash" | "check" | "bank_transfer" | "gcash" | "other";

export interface SavingsTransaction {
  id: number;
  reference_number: string;
  transaction_date: string;
  created_at: string;
  type: SavingsTransactionType;
  description: string | null;
  account_id: number;
  account_number: string;
  member_name: string;
  branch?: { id: number; name: string } | null;
  debit: Money;
  credit: Money;
  /** Balance before and after, as the server posted them. */
  previous_balance: Money | null;
  running_balance: Money | null;
  payment_method?: SavingsPaymentMethod | null;
  remarks?: string | null;
  status: SavingsTransactionStatus;
  processed_by: { id: number; name: string } | null;
  approved_by?: { id: number; name: string } | null;
  /** On a reversal: the transaction it reverses. */
  reversal_of?: { id: number; reference_number: string } | null;
  /** On a reversed transaction: the reversal that undid it. */
  reversed_by?: { id: number; reference_number: string } | null;
  /** A pending reversal request against this transaction, if any. */
  pending_reversal?: { id: number; reason: string; requested_by: { id: number; name: string } | null } | null;
  /** On a transfer leg: the other account. */
  counterparty?: { account_id: number; account_number: string; member_name: string } | null;
  /** Interest posting only: the batch it came from. */
  interest_batch_id?: number | null;
}

interface MoneyMovementPayload {
  account_id: number;
  amount: number;
  transaction_date: string;
  payment_method: SavingsPaymentMethod;
  reference_number?: string;
  remarks?: string;
}

export type SavingsDepositPayload = MoneyMovementPayload;
export type SavingsWithdrawalPayload = MoneyMovementPayload;

export interface SavingsTransferPayload {
  from_account_id: number;
  to_account_id: number;
  amount: number;
  transaction_date: string;
  reference_number?: string;
  remarks?: string;
}

export interface SavingsTransferResult {
  reference_number: string;
  debit: SavingsTransaction;
  credit: SavingsTransaction;
}

export interface SavingsTransactionTotals {
  total_debit: Money;
  total_credit: Money;
  count: number;
}

// ── Interest ──

export type InterestBatchStatus = "draft" | "approved" | "posted" | "reversed" | "rejected";

/** One account's figures in a preview or batch. Inputs are kept per row. */
export interface InterestPostingRow {
  account_id: number;
  account_number: string;
  member_name: string;
  product_name: string;
  average_daily_balance: Money;
  eligible_days: number;
  days_in_period: number;
  rate: Money;
  day_count_basis: DayCountBasis;
  interest_amount: Money;
  /** Why an account earned nothing (below minimum balance, frozen, …). */
  skip_reason?: string | null;
  transaction_id?: number | null;
}

export interface InterestPreviewRequest {
  period_from: string;
  period_to: string;
  savings_product_id?: number | null;
  branch_id?: number | null;
}

export interface InterestTotals {
  accounts: number;
  eligible_accounts: number;
  total_interest: Money;
}

export interface InterestPreview {
  request: InterestPreviewRequest;
  rows: InterestPostingRow[];
  totals: InterestTotals;
}

export interface InterestBatch {
  id: number;
  reference_number: string;
  period_from: string;
  period_to: string;
  product: { id: number; name: string } | null;
  branch: { id: number; name: string } | null;
  status: InterestBatchStatus;
  /** Whether this draft must be approved before posting (savings settings at creation). */
  requires_approval?: boolean;
  totals: InterestTotals;
  created_by: { id: number; name: string } | null;
  approved_by: { id: number; name: string } | null;
  posted_by: { id: number; name: string } | null;
  reversed_by?: { id: number; name: string } | null;
  reversal_reason?: string | null;
  created_at: string;
  posted_at: string | null;
}

export interface InterestBatchDetail extends InterestBatch {
  rows: InterestPostingRow[];
}

// ── Dashboard ──

export interface SavingsDashboard {
  total_deposits: Money;
  accounts: SavingsAccountStats;
  today: {
    deposits: Money;
    deposit_count: number;
    withdrawals: Money;
    withdrawal_count: number;
  };
  pending_approvals: number;
  interest_posted_ytd: Money;
}

// ── Audit ──

export interface SavingsAuditEntry {
  id: number;
  action: string;
  record: string;
  old_value: string | null;
  new_value: string | null;
  reference_number: string | null;
  user: { id: number; name: string } | null;
  branch_id: number | null;
  created_at: string;
}
