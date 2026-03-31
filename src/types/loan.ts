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

export interface Loan {
  id: number;
  application_number?: string;
  borrower_id: number;
  borrower_name?: string;
  co_maker_id?: number;
  co_maker_name?: string;
  loan_product_id?: number;
  loan_product_name?: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: "fixed" | "diminishing";
  term_months: number;
  payment_frequency: "daily" | "weekly" | "bi_weekly" | "monthly";
  processing_fee?: number;
  service_fee?: number;
  other_deductions?: number;
  net_proceeds?: number;
  total_payable: number;
  outstanding_balance: number;
  status: LoanStatus;
  purpose?: string;
  collateral?: string;
  co_maker?: string;
  // Approval workflow fields
  approval_remarks?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_remarks?: string;
  rejected_by?: string;
  rejected_at?: string;
  released_by?: string;
  released_at?: string;
  release_date?: string;
  maturity_date?: string;
  next_due_date?: string;
  created_at: string;
  updated_at: string;
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
  interest_type: "fixed" | "diminishing";
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
