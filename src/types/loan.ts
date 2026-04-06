import type { ApiScheduleRow } from "@/lib/amortization";

export type LoanStatus =
  | "draft"
  | "for_review"
  | "approved"
  | "rejected"
  | "released"
  | "ongoing"
  | "completed"
  | "defaulted"
  | "restructured"
  | "closed";

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
  penalty_rate: number;
  grace_period: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
