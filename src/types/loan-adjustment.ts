export type LoanAdjustmentType =
  | "restructure"
  | "penalty_waiver"
  | "balance_adjustment"
  | "term_extension";

export type LoanAdjustmentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "applied";

export interface LoanAdjustment {
  id: number;
  loan_id: number;
  adjustment_type: LoanAdjustmentType;
  new_values: Record<string, unknown>;
  description?: string;
  remarks?: string;
  status: LoanAdjustmentStatus;
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  applied_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLoanAdjustmentData {
  adjustment_type: LoanAdjustmentType;
  new_values: Record<string, unknown>;
  description?: string;
  remarks?: string;
}
