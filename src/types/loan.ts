import type { ApiScheduleRow } from "@/lib/amortization";
import type { StaffMember } from "./staff";

export type LoanStatus =
  | "draft"
  | "for_review"
  | "approved"
  | "rejected"
  | "released"
  | "current"
  | "past_due"
  // Legacy: kept so data returned by older backend versions still parses.
  // New code paths should prefer `current` / `past_due`.
  | "ongoing"
  | "completed"
  | "defaulted"
  | "restructured"
  | "closed"
  // `void` is a reserved WORD, not a reserved string: it is legal both as a
  // union member here and as an object key in the maps below, and the compiler
  // treats it like any other literal. Verified, because the reserved-word
  // instinct is exactly why it kept being left out.
  //
  // Set by `LoanService::voidLoan()` — a draft struck from the record. It is in
  // the `loans.status` enum and `LoanController::index()` reports a count for
  // it, but no frontend map had a key for it, so it rendered as an unstyled
  // pill reading "void". Adding it here is what makes that a build error
  // everywhere instead: the label and colour maps are keyed off this union.
  | "void";

// Unit for Past Due Transfer config on LoanProduct: how the value is
// interpreted when deciding when a missed payment becomes past_due.
export type PastDueTransferUnit = "days" | "months" | "amortization_periods";

export type InterestType = "fixed" | "diminishing" | "upon_maturity";

/**
 * One upfront charge withheld from the principal at release.
 *
 * This is what `LoanService::computeDeductions()` persists into
 * `loans.deductions` and what every consumer reads back — an ARRAY of items,
 * not a `Record<string, number>` keyed by fee name. The old typing was wrong on
 * the wire, and the loan detail page had already worked around it with a cast
 * (see `deductionsArray`) after every fee silently collapsed into "Other
 * Deductions".
 *
 * `amount` is the peso figure actually withheld; `original_value` is what was
 * configured, which for a percentage fee is the rate, not the peso amount.
 */
export interface LoanDeduction {
  name: string;
  amount: number;
  type: "fixed" | "percentage";
  original_value: number;
  /** Set on an item charged from a fee rule in Settings, at or for release. */
  fee_id?: number;
}

/**
 * `GET /loans/{id}/release-preview`: what releasing the loan would withhold,
 * computed the way the release itself computes it
 * (`LoanReleaseFeeService::preview()`).
 *
 * `deductions` are the loan's recorded deductions plus one item per
 * configured fee that applies to it; `total_deductions` and `net_proceeds`
 * include them. Insurance is not in any of it: it is typed at release. The two
 * totals arrive as 2-decimal strings.
 *
 * `fee_fingerprint` goes back with the release, which is refused with a 409 if
 * the fee configuration changed in between. `overlap_warnings` name configured
 * fees that repeat one of the product's own; both are charged.
 */
export interface LoanReleasePreview {
  deductions: LoanDeduction[];
  total_deductions: string;
  net_proceeds: string;
  fee_fingerprint: string;
  overlap_warnings?: { fee_id: number; fee_name: string; message: string }[];
}

/**
 * A loan in a restructure chain, as `LoanResource` flattens it. Flat rather
 * than a nested `Loan` so a chain of restructures cannot recurse.
 */
interface RestructureLinkedLoan {
  id: number;
  application_number: string;
  loan_account_number: string | null;
  status: LoanStatus;
  principal_amount: number;
}

/** `Loan.source_loan`. */
export interface RestructureSourceLoan extends RestructureLinkedLoan {
  restructured_at: string | null;
  restructured_balance: number | null;
  write_off_amount: number | null;
}

/** One entry of `Loan.restructured_into`. */
export interface RestructuredIntoLoan extends RestructureLinkedLoan {
  start_date: string | null;
}

/**
 * A co-maker linked to a loan, as a loan payload embeds it: the co-maker
 * record (`CoMakerResource`) plus who linked it to the loan and when, `null`
 * where the server has no record of that. Absent on payloads from before the
 * API sent them.
 */
export interface LoanCoMaker {
  id: number;
  borrower_id?: number;
  full_name?: string;
  name?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string;
  address?: string;
  contact_number?: string;
  relationship_to_borrower?: string;
  added_by?: number | null;
  added_at?: string | null;
}

export interface Loan {
  id: number;
  application_number?: string;
  loan_account_number?: string;
  // Nested relations from API
  borrower?: { id: number; full_name?: string; name?: string; address?: string; borrower_code?: string };
  loan_product?: { id: number; name?: string; description?: string };
  branch?: { id: number; name?: string };
  /** Exactly the co-makers linked to this loan; `GET /loans/{id}` always loads them. */
  co_makers?: LoanCoMaker[];
  approved_by_user?: { id: number; full_name?: string; name?: string };
  released_by_user?: { id: number; full_name?: string; name?: string };
  rejected_by_user?: { id: number; full_name?: string; name?: string };
  created_by_user?: { id: number; full_name?: string; name?: string };
  account_officer_id?: number | null;
  /** Null when no officer is assigned; absent when the endpoint did not load it. */
  account_officer?: StaffMember | null;
  // Flat fields matching API
  interest_rate: number;
  interest_method?: string;
  term?: number;
  /** Unit `term` is a length in; absent on older payloads, which mean months. */
  term_unit?: "months" | "days";
  /** Period `interest_rate` is quoted per; absent on older payloads, which mean monthly. */
  interest_rate_frequency?: "daily" | "weekly" | "bi_weekly" | "semi_monthly" | "monthly";
  /**
   * How many times this loan has been rolled forward via the Extend Loan
   * action. Distinct from `term`, which is the originally agreed term —
   * use this alongside `term` rather than reading extensions off of it.
   */
  extension_count?: number;
  /**
   * Whether the loan is eligible for the Extend Loan action. The server owns
   * this rule — read the flag rather than recomputing it from `term` and
   * `frequency`, so eligibility stays in one place if the rule changes.
   */
  is_one_month_term?: boolean;
  frequency?: string;
  principal_amount: number;
  start_date?: string;
  maturity_date?: string;
  deductions?: LoanDeduction[];
  total_deductions?: number;
  net_proceeds?: number;
  penalty_rate?: number;
  grace_period_days?: number;
  // Share Capital Build-Up amount chosen for this loan (within product's range)
  scb_amount?: number;
  // Policy Exception — when true, loan follows the full BOD approval chain
  policy_exception?: boolean;
  policy_exception_details?: string;
  policy_exception_letter?: string; // URL to uploaded letter
  status: LoanStatus;
  is_editable?: boolean;
  is_releasable?: boolean;
  // Approval workflow fields
  approval_remarks?: string;
  approved_at?: string;
  released_at?: string;
  rejection_remarks?: string;
  rejected_at?: string;
  amortization_schedules?: ApiScheduleRow[];
  created_at: string;
  updated_at: string;
  // Restructure — set on the new loan that was created from a restructure
  is_restructure?: boolean;
  source_loan_id?: number;
  /** When a restructure's release closed this loan; null on any other loan. */
  restructured_at?: string | null;
  /** What was still owed on this loan when the restructure closed it. */
  restructured_balance?: number | null;
  /** The part of `restructured_balance` the new loan did not take on. */
  write_off_amount?: number | null;
  /** The loan this one was restructured out of. Only `GET /loans/{id}` loads it. */
  source_loan?: RestructureSourceLoan | null;
  /**
   * Every restructure application raised on this loan, rejected and voided ones
   * included. Only `GET /loans/{id}` loads it.
   */
  restructured_into?: RestructuredIntoLoan[];

  // Auto-Pay
  auto_pay_enabled?: boolean;
  auto_pay_cbs_reference?: string | null;
  auto_pay_enabled_at?: string | null;
  auto_pay_enabled_by?: number | null;

  // Legacy aliases — kept for backward compat with components that use old field names
  borrower_id?: number;
  borrower_name?: string;
  loan_product_id?: number;
  loan_product_name?: string;
  interest_type?: InterestType;
  term_months?: number;
  payment_frequency?: string;
  processing_fee?: number;
  service_fee?: number;
  other_deductions?: number;
  total_payable?: number;
  outstanding_balance?: number;
  purpose?: string;
  collateral?: string;
  approved_by?: string;
  rejected_by?: string;
  released_by?: string;
  release_date?: string;
  next_due_date?: string;
}

export interface LoanSchedule {
  id: number;
  loan_id: number;
  due_date: string;
  principal: number;
  interest: number;
  amount_due: number;
  amount_paid: number;
  balance: number;
  status: "pending" | "paid" | "partial" | "overdue";
}

/** One component of a period: what was due, what the payments covered, what is left. */
export interface AmortizationComponentBalance {
  due: number;
  paid: number;
  balance: number;
}

/** Penalty is charged rather than scheduled, hence `charged` for `due`. */
export interface AmortizationPenaltyBalance {
  charged: number;
  paid: number;
  balance: number;
}

/** One period of `GET /loans/{id}/amortization-balances`. */
export interface AmortizationBalancePeriod {
  id: number;
  period_number: number;
  due_date: string;
  status: "pending" | "paid" | "partial" | "overdue";
  /** Unpaid past its grace period: the same test as the summary's `overdue_amount`. */
  is_late: boolean;
  principal: AmortizationComponentBalance;
  interest: AmortizationComponentBalance;
  penalty: AmortizationPenaltyBalance;
  /** Principal + interest + penalty still owed on this period. */
  balance: number;
}

/**
 * `GET /loans/{id}/amortization-balances`: what is still owed on each period,
 * per component. Every figure is the server's. `totals.balance`, `paid` and
 * `overdue` are the summary's `outstanding_balance`, `total_paid` and
 * `overdue_amount`.
 */
export interface LoanAmortizationBalances {
  periods: AmortizationBalancePeriod[];
  totals: {
    principal: AmortizationComponentBalance;
    interest: AmortizationComponentBalance;
    penalty: AmortizationPenaltyBalance;
    paid: number;
    balance: number;
    overdue: number;
  };
}

/**
 * A single debit/credit posting against the loan — currently only ever
 * raised by Extend Loan (a debit for the interest the extension accrues,
 * plus a credit — linked via `repayment_id` — when that interest is collected
 * immediately rather than deferred). The API's schema allows `category` to
 * widen to "principal" / "penalty" later even though only "interest" entries
 * are written today — callers should filter by category rather than assuming
 * every entry belongs to the Interest column.
 */
export interface LoanLedgerEntry {
  id: number;
  type: "debit" | "credit";
  category: "principal" | "interest" | "penalty";
  amount: number;
  entry_date: string;
  description: string;
  loan_adjustment_id: number | null;
  repayment_id: number | null;
  created_at: string;
}

export interface LoanProduct {
  id: number;
  name: string;
  description?: string;
  min_amount: number;
  max_amount: number;
  interest_rate: number;
  interest_type: InterestType;
  // Period the interest rate figure is quoted per (e.g. "3% per month").
  // Absent on products created before this field existed — callers should
  // default to "monthly", the rate's long-standing implicit basis.
  interest_rate_frequency?: "daily" | "weekly" | "bi_weekly" | "semi_monthly" | "monthly";
  min_term: number;
  max_term: number;
  // Unit the term range is expressed in. Absent on products created before
  // this field existed — callers should default to "months".
  term_unit?: "months" | "days";
  payment_frequency: "daily" | "weekly" | "bi_weekly" | "monthly";
  processing_fee: number;
  service_fee: number;
  notarial_fee?: number;
  // Optional fee range (percentages). When present, the new loan application
  // constrains the user-editable fee percent to [min, max] per fee type.
  min_processing_fee?: number;
  max_processing_fee?: number;
  min_service_fee?: number;
  max_service_fee?: number;
  penalty_rate: number;
  grace_period: number;
  // Past Due Transfer — determines when a missed payment flips the loan's
  // status to `past_due`. `past_due_transfer_value` is a positive integer;
  // `past_due_transfer_unit` says how to interpret it (days, months, or
  // number of amortization periods). Both are optional — a product with
  // neither set falls back to the backend's default behavior.
  past_due_transfer_value?: number;
  past_due_transfer_unit?: PastDueTransferUnit;
  // Share Capital Build-Up (SCB) — optional required contribution added to
  // every amortization period. When the borrower pays, the SCB portion is
  // credited to their share capital ledger.
  scb_required?: boolean;
  min_scb?: number;
  max_scb?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
