/**
 * Savings & Deposits, staff side. The contract is lendyph-backend's savings
 * design §2 (Phase 3, Wave 1); response fields carry the design's column
 * names (§1), request bodies keep set B's names (`payment_method`,
 * `reference`, `date`) as the design's account-opening body does.
 *
 * Money is a two-decimal string ("1234.50") and rates a four-decimal percent
 * string ("1.2500"). Show them with `formatCurrency` / `formatRate`; the
 * browser never adds, nets or derives them.
 */

import type { PaginatedResponse } from "./api";

/** A peso figure as the server sends it: two decimals, as text. */
export type MoneyString = string;
/** A percent per year as the server sends it ("1.2500"). Never rounded. */
export type RateString = string;

/** Who did something; `null` means the system did (shown as "System"). */
export interface SavingsUserRef {
  id: number;
  name: string;
}

// ── Settings and tax rules ──

export type SavingsHolderType = "member" | "non_member";

/** One append-only tax rule; the latest `effective_from` on or before a date is in force. */
export interface SavingsTaxRule {
  id: number;
  holder_type: SavingsHolderType;
  rate: RateString;
  effective_from: string;
  created_at?: string | null;
}

export interface SavingsSettings {
  /** Up to this amount, a withdrawal or payout posts at once. */
  tier1_limit: MoneyString;
  /** Up to this amount, one checker approves; above it, `tier3_checkers` different checkers. */
  tier2_limit: MoneyString;
  tier3_checkers: number;
  dormancy_months: number;
  large_transaction_alert: MoneyString;
  /** The rate in force today per holder type. */
  current_tax_rates: Record<SavingsHolderType, RateString>;
  tax_rules: SavingsTaxRule[];
  /**
   * False while the chart lacks a savings account or posting role (backend
   * S6); `books_missing` says what, in words. Absent before S6.
   */
  books_ready?: boolean;
  books_missing?: string[];
  updated_by?: SavingsUserRef | null;
  updated_at?: string | null;
}

export interface SavingsSettingsInput {
  tier1_limit: string;
  tier2_limit: string;
  /** The server accepts only 2 (dual control) in v1. */
  tier3_checkers: number;
  dormancy_months: number;
  large_transaction_alert: string;
}

/** `POST /savings/settings/prepare-books`: what setting up the books did, each a sentence. */
export interface PrepareBooksResult {
  books_ready: boolean;
  books_missing: string[];
  added: string[];
  mapped: string[];
  unchanged: string[];
  skipped: string[];
}

export interface SavingsTaxRuleInput {
  holder_type: SavingsHolderType;
  rate: string;
  /** On or after today (Manila). */
  effective_from: string;
}

// ── Products and rates ──

/** `regular` is a passbook savings account; `time_deposit` is placed for a fixed term. */
export type SavingsProductKind = "regular" | "time_deposit";

export type InterestCrediting = "monthly" | "quarterly" | "semi_annual" | "annual";

/** One append-only rate row. `term_days` is null on a regular product. */
export interface SavingsProductRate {
  id?: number;
  product_id?: number;
  term_days: number | null;
  annual_rate: RateString;
  /** The tier's least balance; null (or absent before tiers) is the base tier. */
  min_balance?: MoneyString | null;
  effective_from: string;
  created_at?: string | null;
  created_by?: SavingsUserRef | null;
  /**
   * On `current_rates` only: the whole ladder in force, base tier first. One
   * row on a single-rate product and on each time deposit term.
   */
  tiers?: SavingsRateTier[];
}

// ── Product rules, tiers and opening (gap round F4a; backend S1 and S2) ──

/** One step of a rate ladder: from `min_balance` up (null is the base tier, any balance). */
export interface SavingsRateTier {
  min_balance: MoneyString | null;
  annual_rate: RateString;
  effective_from?: string;
}

/** The member types a product may be open to. */
export type SavingsMemberType = "regular" | "associate";

/**
 * A regular product's rules (S1). A null limit is no limit; a null
 * `free_withdrawals_per_month` is unlimited; a null `excess_withdrawal_fee`
 * refuses withdrawals beyond the free count. Null eligibility lists mean
 * everyone. A time deposit product takes only the eligibility fields.
 */
export interface SavingsProductRules {
  max_balance: MoneyString | null;
  min_deposit: MoneyString | null;
  max_deposit: MoneyString | null;
  min_withdrawal: MoneyString | null;
  max_withdrawal: MoneyString | null;
  free_withdrawals_per_month: number | null;
  excess_withdrawal_fee: MoneyString | null;
  allow_deposits: boolean;
  allow_withdrawals: boolean;
  allow_transfers: boolean;
  eligible_member_types: SavingsMemberType[] | null;
  eligible_branch_ids: number[] | null;
}

/** The rule fields a create or update sends; a time deposit product sends only the eligibility ones. */
export type SavingsProductRulesInput = Partial<SavingsProductRules>;

/** `POST /savings/products/{id}/rates` with a ladder (regular products only): base tier first. */
export interface SavingsTierRateInput {
  tiers: Array<{ min_balance: string | null; annual_rate: string }>;
  /** On or after today (Manila). */
  effective_from: string;
}

/** Where the opening money comes from (`source_of_funds`). */
export type SavingsSourceOfFunds = "salary" | "business" | "remittance" | "pension" | "savings" | "other";

export interface SavingsBeneficiary {
  name: string | null;
  relationship: string | null;
  /** Null without borrowers:view and the member's branch (round fz rule). */
  contact_number: string | null;
}

/** The opening details an account carries (S1). */
export interface SavingsOpeningDetails {
  account_officer?: SavingsUserRef | null;
  source_of_funds?: SavingsSourceOfFunds | null;
  source_of_funds_other?: string | null;
  /** In words ("Other: Rental income"). */
  source_of_funds_label?: string | null;
  beneficiary?: SavingsBeneficiary | null;
}

/** The opening details `POST /savings/accounts` takes, each optional. */
export interface SavingsOpeningDetailsInput {
  account_officer_id?: number;
  source_of_funds?: SavingsSourceOfFunds;
  /** Required with `other`. */
  source_of_funds_other?: string;
  beneficiary?: { name?: string; relationship?: string; contact_number?: string };
}

/**
 * `GET /savings/opening-check?borrower_id=`: the member's standing before an
 * account is opened. Every figure is the server's; a null is a figure the
 * caller may not see (loans without loans:view, share capital without
 * share_capital:view) or one the member doesn't have.
 */
export interface SavingsOpeningCheck {
  member: {
    id: number;
    name: string | null;
    borrower_code: string | null;
    membership_number: string | null;
    status: string | null;
    branch_id: number | null;
    branch_name: string | null;
    membership_date: string | null;
    member_type: SavingsMemberType | null;
  };
  loans: { collectible_count: number | null; total_outstanding: MoneyString | null };
  share_capital_balance: MoneyString | null;
  savings_accounts: Array<{
    id: number;
    account_number: string;
    product_id: number;
    product_name: string | null;
    product_kind: SavingsProductKind | null;
    status: SavingsAccountStatus;
    balance: MoneyString;
  }>;
  /** Active regular products the member may open and holds no open account on. */
  eligible_products: Array<{
    id: number;
    code: string;
    name: string;
    minimum_opening_balance: MoneyString;
    maintaining_balance: MoneyString;
  }>;
}

export interface SavingsProduct extends Partial<SavingsProductRules> {
  id: number;
  code: string;
  name: string;
  kind: SavingsProductKind;
  interest_crediting: InterestCrediting;
  /** The least an account can be opened with (or a time deposit placed with). */
  minimum_opening_balance: MoneyString;
  /** A withdrawal may not take the balance below this. */
  maintaining_balance: MoneyString;
  /** Below this average daily balance the period earns no interest. */
  minimum_adb_for_interest: MoneyString;
  /** Time deposits only: the terms, in days, a placement may choose. */
  term_options_days: number[] | null;
  /** Time deposits only: the regular product whose rate pays an early termination. */
  pretermination_product_id: number | null;
  is_active: boolean;
  /** The rate in force today, one per term (one row on a regular product). */
  current_rates: SavingsProductRate[];
  /** Accounts and time deposits on this product. */
  account_count: number;
  /** False once any account or time deposit exists (delete answers 422). */
  can_delete: boolean;
}

/** `POST /savings/products`. `annual_interest_rate` becomes the first rate row, on create only. */
export interface SavingsProductCreateInput extends SavingsProductRulesInput {
  code: string;
  name: string;
  kind: SavingsProductKind;
  interest_crediting: InterestCrediting;
  minimum_opening_balance: string;
  maintaining_balance: string;
  minimum_adb_for_interest: string;
  /** Time deposits only; left out on a regular product. */
  term_options_days?: number[];
  /** Time deposits only; left out on a regular product. */
  pretermination_product_id?: number | null;
  is_active: boolean;
  annual_interest_rate: string;
}

/**
 * `PUT /savings/products/{id}`: the product's terms; rates go through the rates
 * endpoint. The time-deposit fields are left out on a regular product (the
 * server refuses them there).
 */
export type SavingsProductUpdateInput = Omit<
  SavingsProductCreateInput,
  "annual_interest_rate" | "kind" | "term_options_days" | "pretermination_product_id"
> & {
  term_options_days?: number[];
  pretermination_product_id?: number | null;
};

export interface SavingsRateInput {
  annual_rate: string;
  term_days?: number | null;
  /** On or after today (Manila). */
  effective_from: string;
}

// ── Accounts ──

export type SavingsAccountStatus = "active" | "dormant" | "frozen" | "closed";

export interface SavingsAccount extends SavingsOpeningDetails {
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
  balance: MoneyString;
  /** Active holds. */
  hold_amount: MoneyString;
  /**
   * The part of `hold_amount` that members' portal withdrawal requests
   * reserve (the member sees it as "Pending withdrawal"). Sent by backends
   * from P4 (#292) on; absent before.
   */
  held_for_requests?: MoneyString | null;
  /** Outflows waiting for approval. */
  pending_amount: MoneyString;
  /** What a withdrawal can take now. Server-computed. */
  available_balance: MoneyString;
  /** Earned since the last credit, not yet credited (display only). */
  accrued_interest: MoneyString;
  interest_credited_through: string | null;
  opened_on: string;
  last_member_activity_on: string | null;
  dormant_since: string | null;
  closed_on: string | null;
  close_reason: string | null;
  remarks: string | null;
}

/**
 * `GET /savings/accounts`: one page, `meta.stats` (accounts per status) and
 * `meta.totals` over the whole filter.
 */
export interface SavingsAccountsResponse extends PaginatedResponse<SavingsAccount> {
  meta: PaginatedResponse<SavingsAccount>["meta"] & {
    stats?: Partial<Record<SavingsAccountStatus, number>>;
    totals?: { account_count: number; total_balance: MoneyString };
  };
}

/** How money came in or went out. `savings` is a transfer from a savings account. */
export type SavingsMethod = "cash" | "bank_transfer" | "gcash" | "maya" | "savings";

export interface OpenSavingsAccountInput extends SavingsOpeningDetailsInput {
  borrower_id: number;
  product_id: number;
  /** YYYY-MM-DD, Asia/Manila. */
  opened_at: string;
  initial_deposit: string;
  payment_method: SavingsMethod;
  reference?: string;
}

// ── Transactions ──

export type SavingsTransactionType =
  | "deposit"
  | "withdrawal"
  | "transfer_in"
  | "transfer_out"
  | "interest"
  | "withholding_tax"
  | "closing"
  | "reversal"
  // Gap round S1 and S3: an excess-withdrawal fee (linked to its withdrawal)
  // and a transfer to the member's share capital (never reversed).
  | "fee"
  | "share_capital_transfer";

/** One ledger line. `credit` adds to the balance, `debit` takes from it; one of them is "0.00". */
export interface SavingsTransaction {
  id: number;
  account_id: number;
  account_number?: string | null;
  borrower_name?: string | null;
  reference: string;
  type: SavingsTransactionType;
  date: string;
  value_date: string;
  debit: MoneyString;
  credit: MoneyString;
  /** The balance after this line, in posting order. */
  balance_after: MoneyString;
  method: SavingsMethod | null;
  external_reference: string | null;
  remarks: string | null;
  counterpart_transaction_id: number | null;
  reverses_transaction_id: number | null;
  /** Set when a reversal of this line has posted. */
  reversed_by_transaction_id?: number | null;
  /** Set while a reversal request waits for approval. */
  pending_reversal_approval_id?: number | null;
  time_deposit_id: number | null;
  interest_run_id: number | null;
  approval_id: number | null;
  /** On a withdrawal that charged an excess-withdrawal fee (gap round S1): its linked `fee` row and amount. */
  fee_transaction_id?: number | null;
  fee_amount?: MoneyString | null;
  /** On a `fee` row: the withdrawal it was charged on. */
  fee_for_transaction_id?: number | null;
  /** Null when the system posted it. */
  created_by: SavingsUserRef | null;
  created_at: string | null;
}

/** `GET …/{id}/transactions`: `meta.opening_balance` and `meta.totals` cover the filter. */
export interface SavingsTransactionsResponse extends PaginatedResponse<SavingsTransaction> {
  meta: PaginatedResponse<SavingsTransaction>["meta"] & {
    opening_balance?: MoneyString;
    totals?: { debit: MoneyString; credit: MoneyString };
  };
}

/** A deposit or a withdrawal. */
export interface SavingsTransactionInput {
  amount: string;
  /** YYYY-MM-DD, Asia/Manila. */
  date: string;
  payment_method: SavingsMethod;
  reference?: string;
  remarks?: string;
}

export interface SavingsTransferInput {
  to_account_id: number;
  amount: string;
  /** YYYY-MM-DD, Asia/Manila. */
  date: string;
  remarks?: string;
}

/** `POST …/{id}/transfers` answers 201 with both legs. */
export interface SavingsTransferResult {
  transfer_out: SavingsTransaction;
  transfer_in: SavingsTransaction;
}

export interface CloseSavingsAccountInput {
  /** YYYY-MM-DD, Asia/Manila. */
  date: string;
  reason: string;
  /** How the balance and the interest credited at close are paid out. */
  payout_method: SavingsMethod;
}

/** `GET …/{id}/closing-quote`: what closing today credits and pays. */
export interface SavingsClosingQuote {
  balance: MoneyString;
  accrued_interest: MoneyString;
  withholding_tax: MoneyString;
  payout_amount: MoneyString;
  can_close: boolean;
  /** Why it can't close, in words. */
  blockers: string[];
}

export interface SavingsStatusInput {
  status: "frozen" | "active";
  reason: string;
}

// ── Holds ──

/** `member_request`: a Member Portal withdrawal request's reservation (placed and released by the request). */
export type SavingsHoldType = "legal" | "manual" | "loan_retention" | "member_request";
export type SavingsHoldStatus = "active" | "released" | "expired";

/** Money set aside on an account. An active hold comes off `available_balance`. */
export interface SavingsHold {
  id: number;
  account_id: number;
  type: SavingsHoldType;
  amount: MoneyString;
  reason: string;
  placed_on: string;
  expires_on: string | null;
  status: SavingsHoldStatus;
  released_on: string | null;
  release_reason: string | null;
  created_by: SavingsUserRef | null;
  released_by: SavingsUserRef | null;
}

export interface PlaceSavingsHoldInput {
  type: Exclude<SavingsHoldType, "loan_retention">;
  amount: string;
  reason: string;
  /** YYYY-MM-DD, or omitted to hold until released. */
  expires_on?: string;
}

export interface ReleaseSavingsHoldInput {
  reason: string;
}

// ── Approvals (maker-checker) ──

export type SavingsApprovalKind =
  | "withdrawal"
  | "close"
  | "td_payout"
  | "pretermination"
  | "reversal"
  // Gap round S3 and S4: a transfer to share capital above the first tier, and
  // a staff reactivation of a dormant account (one checker, ₱0.00).
  | "share_capital_transfer"
  | "reactivation";
export type SavingsApprovalStatus = "pending" | "approved" | "rejected" | "cancelled" | "expired";

export interface SavingsApproval {
  id: number;
  kind: SavingsApprovalKind;
  status: SavingsApprovalStatus;
  account_id: number | null;
  account_number?: string | null;
  time_deposit_id: number | null;
  certificate_number?: string | null;
  borrower_name?: string | null;
  branch_name?: string | null;
  target_transaction_id: number | null;
  target_reference?: string | null;
  amount: MoneyString;
  /** The excess-withdrawal fee it carries besides `amount` ("0.00" when none; gap round S1). */
  fee_amount?: MoneyString;
  /** How many different checkers it needs (2 above the second tier). */
  required_checkers: number;
  requested_by: SavingsUserRef | null;
  first_checker: SavingsUserRef | null;
  decided_by: SavingsUserRef | null;
  decision_reason: string | null;
  decided_at: string | null;
  /** End of the Manila business day it was requested on. */
  expires_at: string | null;
  result_transaction_id: number | null;
  created_at: string | null;
  /**
   * Why it needs a checker when its amount alone wouldn't (gap round S4): the
   * first money out on the day a deposit reactivated the account. In words.
   */
  check_reason?: string | null;
}

/** A money post above the first tier answers 202 with this instead of the record. */
export interface SavingsApprovalEnvelope {
  approval: SavingsApproval;
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
  principal: MoneyString;
  /** Snapshotted at placement. */
  annual_rate: RateString;
  pretermination_rate: RateString | null;
  withholding_tax_rate: RateString;
  term_days: number;
  placement_date: string;
  maturity_date: string;
  gross_interest: MoneyString;
  withholding_tax: MoneyString;
  net_interest: MoneyString;
  maturity_amount: MoneyString;
  maturity_instruction: MaturityInstruction;
  /** Null on a rollover: the earlier placement (`rolled_over_from_id`) funded it. */
  funding_method: SavingsMethod | null;
  payout_account_id: number | null;
  payout_account_number?: string | null;
  status: TimeDepositStatus;
  settled_on: string | null;
  settled_interest: MoneyString | null;
  settled_tax: MoneyString | null;
  settled_amount: MoneyString | null;
  payout_method: SavingsMethod | null;
  /** Null when the system settled it (shown as "System"). */
  settled_by: SavingsUserRef | null;
  /**
   * Days and interest after the maturity date: what a late settlement paid, or
   * what settling today would pay on a placement past maturity. Null when the
   * server couldn't work it out.
   */
  post_maturity_days: number | null;
  post_maturity_interest: MoneyString | null;
  rolled_over_from_id: number | null;
  rolled_over_to_id?: number | null;
  created_by: SavingsUserRef | null;
  created_at?: string | null;
  /**
   * A settlement or pre-termination waiting for approval, or null. Optional
   * until backend slice S5 sends it on list and show.
   */
  pending_approval?: {
    id: number;
    kind: SavingsApprovalKind;
    amount: MoneyString;
    requested_by: SavingsUserRef | null;
  } | null;
}

/** `GET /savings/time-deposits`: one page, `meta.stats` per status and `meta.totals` over the filter. */
export interface TimeDepositsResponse extends PaginatedResponse<TimeDeposit> {
  meta: PaginatedResponse<TimeDeposit>["meta"] & {
    stats?: Partial<Record<TimeDepositStatus, number>>;
    totals?: {
      count: number;
      total_principal: MoneyString;
      /** Active placements maturing in the next 30 days. */
      maturing_30_days: number;
    };
  };
}

/** `POST /savings/time-deposits/quote`: the placement's figures, worked out by the server. */
export interface TimeDepositQuoteInput {
  borrower_id?: number;
  product_id: number;
  principal: string;
  term_days: number;
  placement_date: string;
}

export interface TimeDepositQuote {
  annual_rate: RateString;
  withholding_tax_rate: RateString;
  term_days: number;
  maturity_date: string;
  gross_interest: MoneyString;
  withholding_tax: MoneyString;
  net_interest: MoneyString;
  maturity_amount: MoneyString;
}

export interface PlaceTimeDepositInput {
  borrower_id: number;
  product_id: number;
  principal: string;
  /** One of the product's `term_options_days`. */
  term_days: number;
  /** YYYY-MM-DD, Asia/Manila. */
  placement_date: string;
  maturity_instruction: MaturityInstruction;
  payment_method: SavingsMethod;
  reference?: string;
  /** The savings account paying for it, when `payment_method` is `savings`. */
  funding_account_id?: number;
  /** The savings account the maturity pays into, if any. */
  payout_account_id?: number;
}

export interface SettleTimeDepositInput {
  /** YYYY-MM-DD, on or after the maturity date (today or yesterday). */
  date: string;
  action: MaturityInstruction;
  /**
   * How anything paid out leaves the cooperative; left out for `rollover_all`.
   * `savings` pays into the placement's payout account and needs no approval.
   */
  payout_method?: SavingsMethod;
  /**
   * With `payout_method` savings: the member's own active account in the same
   * branch to pay into (backend S6). Before S6 the placement's own payout
   * account is used.
   */
  payout_account_id?: number;
  /** On a rollover: the new placement's instruction (the original's when left out). */
  next_instruction?: MaturityInstruction;
}

export interface PreterminateTimeDepositInput {
  /** YYYY-MM-DD, before the maturity date. */
  date: string;
  reason: string;
  payout_method: SavingsMethod;
  /** With `payout_method` savings: the account to pay into (backend S6). */
  payout_account_id?: number;
}

/** `GET …/{id}/pretermination-quote?date=`: what breaking it on `date` pays. */
export interface PreterminationQuote {
  date: string;
  days_held: number;
  /** The regular rate snapshotted at placement. */
  rate: RateString;
  gross_interest: MoneyString;
  withholding_tax: MoneyString;
  /** "0.00" in v1. */
  penalty: MoneyString;
  payout: MoneyString;
}

// ── Interest runs ──

export type InterestRunStatus = "draft" | "approved" | "posted" | "rejected" | "reversed";

export interface InterestRunLine {
  account_id: number;
  account_number: string | null;
  borrower_id?: number | null;
  borrower_name: string | null;
  borrower_code?: string | null;
  days: number;
  average_daily_balance: MoneyString;
  rate: RateString;
  gross_interest: MoneyString;
  tax_rate: RateString;
  withholding_tax: MoneyString;
  net_interest: MoneyString;
  /** Why the line earns nothing, as a key (`below_minimum_adb`, …). */
  skip_reason: string | null;
  /** The rates behind the line, one segment per rate set in the period (gap round S2). */
  rate_segments?: InterestRateSegment[];
}

/**
 * One rate set over part of a run line's period. A tiered segment adds its
 * ladder (`tiers`) and, for each tier the balance used, the days and
 * centavo-days the server counted (`by_tier`); a single-rate one has neither.
 */
export interface InterestRateSegment {
  from: string;
  to: string;
  rate: RateString;
  tiers?: Array<{ min_balance: MoneyString | null; rate: RateString }>;
  by_tier?: Array<{ min_balance: MoneyString | null; rate: RateString; days: number; balance_days: number }>;
}

export interface InterestRun {
  id: number;
  product: { id: number; code?: string; name: string } | null;
  product_id: number;
  product_name: string | null;
  branch: { id: number; name: string } | null;
  branch_id: number | null;
  branch_name: string | null;
  period_start: string;
  period_end: string;
  status: InterestRunStatus;
  /** Every line in the run, accounts that earned nothing included. */
  account_count: number;
  total_gross: MoneyString;
  total_tax: MoneyString;
  total_net: MoneyString;
  created_by: SavingsUserRef | null;
  /** One checker column on the server: set on an approved run, or as `rejected_by` on a rejected one. */
  approved_by: SavingsUserRef | null;
  approved_at: string | null;
  rejected_by: SavingsUserRef | null;
  rejected_at: string | null;
  reject_reason: string | null;
  posted_by: SavingsUserRef | null;
  posted_at: string | null;
  reversed_by: SavingsUserRef | null;
  reversed_at: string | null;
  reverse_reason: string | null;
  created_at: string | null;
  /** On `GET /savings/interest-runs/{id}`. */
  lines?: InterestRunLine[];
}

export interface InterestRunRequest {
  product_id: number;
  /** The day after the last posted period (the server checks it). */
  period_start: string;
  branch_ids?: number[];
}

/** `POST /savings/interest-runs/preview`: one draft-to-be per branch. Writes nothing. */
export interface InterestRunPreview {
  product?: { id: number; code?: string; name: string } | null;
  period_start: string;
  period_end: string;
  runs: Array<
    Pick<InterestRun, "branch" | "account_count" | "total_gross" | "total_tax" | "total_net"> & {
      lines: InterestRunLine[];
    }
  >;
  totals?: { account_count: number; total_gross: MoneyString; total_tax: MoneyString; total_net: MoneyString };
}
