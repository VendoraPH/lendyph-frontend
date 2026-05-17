export type GCashTransactionType = "cash_in" | "cash_out";

export type GCashTransactionStatus = "pending" | "paid" | "completed";

export interface GCashTransaction {
  id: number;
  reference_no: string;
  transaction_date: string;
  type: GCashTransactionType;
  amount: number;
  charge_amount: number;
  total_amount: number;
  status: GCashTransactionStatus;
  borrower_id: number;
  borrower?: { id: number; full_name: string; borrower_code: string };
  transactor_user_id: number;
  transactor_user?: { id: number; full_name: string };
  remarks?: string | null;
  paid_at?: string | null;
  paid_by_user_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface GCashTier {
  id: number;
  min_amount: number;
  max_amount: number;
  cash_in_rate: number;
  cash_out_rate: number;
  display_order: number;
}

export interface GCashIncomeReport {
  start_date: string;
  end_date: string;
  total_income: number;
  cash_in_count: number;
  cash_out_count: number;
}

export interface GCashPendingItem {
  id: number;
  reference_no: string;
  transaction_date: string;
  borrower: { id: number; full_name: string; borrower_code: string };
  amount: number;
  charge_amount: number;
  total_amount: number;
  days_pending: number;
}

export interface CreateGCashTransactionData {
  borrower_id: number;
  type: GCashTransactionType;
  amount: number;
  is_pending?: boolean;
  remarks?: string;
}

export type GCashListFilters = {
  type?: GCashTransactionType;
  status?: GCashTransactionStatus | "pending_only";
  start_date?: string;
  end_date?: string;
  borrower_id?: number;
  page?: number;
  per_page?: number;
};

export type GCashTierInput = Omit<GCashTier, "id">;
