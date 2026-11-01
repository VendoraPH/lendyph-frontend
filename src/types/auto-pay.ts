export interface AutoPayFilter {
  product_ids: number[];
  date_from: string;
  date_to: string;
}

export interface AutoPayPartialRow {
  loan_id: number;
  schedule_id: number;
  borrower_name: string;
  loan_account: string;
  due_date: string;
  period_number: number;
  total_due: number;
  amount_paid: number;
  remaining_balance: number;
  principal_remaining: number;
  interest_remaining: number;
  penalty_remaining?: number;
}

/** A loan the preview or the run left out, with the server's reason. */
export interface AutoPayLoanIssue {
  loan_id: number;
  loan_account_number: string | null;
  reason: string;
}

/** One loan with full dues in the preview: the server's figures for it. */
export interface AutoPayLoanRow {
  loan_id: number;
  loan_account_number: string | null;
  borrower_name: string;
  total_principal: number;
  total_interest: number;
  total_penalty: number;
  /** Includes the penalty. */
  total_amount: number;
}

export interface AutoPaySummary {
  total_principal: number;
  total_interest: number;
  total_penalty?: number;
  /** Includes the penalty. */
  total_amount: number;
  /** The selected part-paid rows' remaining amount (`include_schedule_ids[]`). */
  partial_total?: number;
  /** What the run posts for that selection: `total_amount` + `partial_total`. */
  grand_total?: number;
  loans_count: number;
}

export interface AutoPayPreview {
  summary: AutoPaySummary;
  loans?: AutoPayLoanRow[];
  partial_rows: AutoPayPartialRow[];
  skips?: AutoPayLoanIssue[];
}

/** `GET /auto-pay/preview`, optionally with the part-paid rows selected. */
export interface AutoPayPreviewQuery extends AutoPayFilter {
  include_schedule_ids?: number[];
}

export interface AutoPayProcessData {
  product_ids: number[];
  date_from: string;
  date_to: string;
  include_schedule_ids: number[];
}

export interface AutoPayRepaymentResult {
  loan_id: number;
  repayment_id: number;
  amount_paid: number;
}

export interface AutoPayResult {
  processed: number;
  skipped: number;
  failed: number;
  repayments: AutoPayRepaymentResult[];
  skips?: AutoPayLoanIssue[];
  failures?: AutoPayLoanIssue[];
}

export interface AutoPayToggleData {
  enabled: boolean;
  cbs_reference?: string | null;
}

export interface AutoPaySettings {
  loan_id: number;
  auto_pay_enabled: boolean;
  cbs_reference: string | null;
  enabled_at: string | null;
  enabled_by_user_id: number | null;
}
