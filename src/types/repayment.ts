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

/**
 * `GET /repayments` `meta.totals`: SUM(amount_paid) of posted (`collected`)
 * and voided (`voided`) repayments over the request's search, loan, member
 * and date filters (its `status` filter is ignored). Summed in SQL; the
 * browser shows them as sent.
 */
export interface RepaymentListTotals {
  collected?: number | string | null;
  voided?: number | string | null;
}

export interface CreateRepaymentData {
  payment_date: string;
  amount_paid: number;
  remarks?: string;
}

export interface VoidRepaymentData {
  void_reason: string;
}
