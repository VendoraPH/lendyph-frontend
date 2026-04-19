import type { ApiScheduleRow } from "@/lib/amortization";

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
  | "closed";

// Unit for Past Due Transfer config on LoanProduct: how the value is
// interpreted when deciding when a missed payment becomes past_due.
export type PastDueTransferUnit = "days" | "months" | "amortization_periods";

export type InterestType = "fixed" | "diminishing" | "upon_maturity";

export interface Loan {
  id: number;
  application_number?: string;
  loan_account_number?: string;
  // Nested relations from API
  borrower?: { id: number; full_name?: string; name?: string; address?: string; borrower_code?: string };
  loan_product?: { id: number; name?: string; description?: string };
  branch?: { id: number; name?: string };
  co_makers?: { id: number; full_name?: string; name?: string; first_name?: string; middle_name?: string; last_name?: string; suffix?: string; address?: string; relationship?: string }[];
  approved_by_user?: { id: number; full_name?: string; name?: string };
  released_by_user?: { id: number; full_name?: string; name?: string };
  created_by_user?: { id: number; full_name?: string; name?: string };
  // Flat fields matching API
  interest_rate: number;
  interest_method?: string;
  term?: number;
  frequency?: string;
  principal_amount: number;
  start_date?: string;
  maturity_date?: string;
  deductions?: Record<string, number>;
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

  // Legacy aliases — kept for backward compat with components that use old field names
  borrower_id?: number;
  borrower_name?: string;
  co_maker_id?: number;
  co_maker_name?: string;
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
  co_maker?: string;
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

export interface LoanProduct {
  id: number;
  name: string;
  description?: string;
  min_amount: number;
  max_amount: number;
  interest_rate: number;
  interest_type: InterestType;
  min_term: number;
  max_term: number;
  payment_frequency: "daily" | "weekly" | "bi_weekly" | "monthly";
  processing_fee: number;
  service_fee: number;
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
