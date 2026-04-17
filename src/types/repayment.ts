export interface Repayment {
  id: number;
  loan_id: number;
  payment_date: string;
  amount_paid: number;
  remarks?: string;
  status: "completed" | "voided";
  void_reason?: string;
  voided_at?: string;
  voided_by?: string;
  created_at: string;
  updated_at: string;
  // Allocation breakdown — how `amount_paid` was split across the loan's
  // outstanding components by the backend repayment engine. All optional
  // because older records and light list responses may omit them.
  principal_paid?: number;
  interest_paid?: number;
  scb_paid?: number;
  penalty_paid?: number;
  excess_amount?: number;
}

export interface CreateRepaymentData {
  payment_date: string;
  amount_paid: number;
  remarks?: string;
}

export interface VoidRepaymentData {
  void_reason: string;
}
