/**
 * The persisted amortization schedule's wire types. Schedules are built by the
 * server only: the Amortization Calculator posts to
 * POST /loans/amortization-calculator, the loan form to POST /loans/preview.
 */

export interface ApiScheduleRow {
  id: number;
  period_number: number;
  due_date: string;
  beginning_balance: number;
  principal_due: number;
  interest_due: number;
  penalty_amount: number;
  total_due: number;
  remaining_balance: number;
  principal_paid: number;
  interest_paid: number;
  penalty_paid: number;
  status: "paid" | "partial" | "overdue" | "pending";
  share_capital_build_up?: number;
  total_payment?: number;
}

export interface ApiAmortizationSchedule {
  schedule: ApiScheduleRow[];
  summary: {
    total_principal: number;
    total_interest: number;
    total_payable: number;
    total_paid: number;
    total_remaining: number;
    paid_periods: number;
    unpaid_periods: number;
    overdue_periods: number;
    partial_periods: number;
  };
}
