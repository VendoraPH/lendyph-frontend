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
}

export interface AutoPaySummary {
  total_principal: number;
  total_interest: number;
  total_amount: number;
  loans_count: number;
}

export interface AutoPayPreview {
  summary: AutoPaySummary;
  partial_rows: AutoPayPartialRow[];
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
}

export interface AutoPayToggleData {
  enabled: boolean;
  cbs_reference?: string;
}

export interface AutoPaySettings {
  loan_id: number;
  auto_pay_enabled: boolean;
  cbs_reference: string | null;
  enabled_at: string | null;
  enabled_by_user_id: number | null;
}
