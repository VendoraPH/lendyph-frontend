export type LoanAdjustmentType =
  | "restructure"
  | "penalty_waiver"
  | "balance_adjustment"
  | "term_extension"
  | "extension";

export type LoanAdjustmentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "applied"
  | "cancelled";

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
  /** The server's answer to "may this user cancel it now": approved, and the user holds `loan_adjustments:approve`. */
  can_cancel?: boolean;
  cancelled_at?: string | null;
  cancelled_by_user?: { id: number; name: string } | null;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;
}

/** `GET /loans/{loan}/balance-adjustment-preview`: the server's figures for a target. */
export interface BalanceAdjustmentPreview {
  outstanding_principal: number | string;
  target_principal_balance: number | string;
  adjustment_amount: number | string;
  resulting_principal_balance: number | string;
}

export interface CreateLoanAdjustmentData {
  adjustment_type: LoanAdjustmentType;
  new_values: Record<string, unknown>;
  description?: string;
  remarks?: string;
}
