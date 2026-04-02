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
}

export interface CreateRepaymentData {
  payment_date: string;
  amount_paid: number;
  remarks?: string;
}

export interface VoidRepaymentData {
  void_reason: string;
}
