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
  // Exactly one of these is set: a transaction belongs either to a member
  // (borrower) or to a walk-in customer saved in the GCash non-member list.
  borrower_id?: number | null;
  borrower?: { id: number; full_name: string; borrower_code: string } | null;
  gcash_non_member_id?: number | null;
  non_member?: { id: number; full_name: string; mobile_number?: string | null } | null;
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
  borrower?: { id: number; full_name: string; borrower_code: string } | null;
  non_member?: { id: number; full_name: string } | null;
  amount: number;
  charge_amount: number;
  total_amount: number;
  days_pending: number;
}

export type CreateGCashTransactionData = {
  type: GCashTransactionType;
  amount: number;
  is_pending?: boolean;
  remarks?: string;
} & ({ borrower_id: number } | { gcash_non_member_id: number });

export type GCashListFilters = {
  type?: GCashTransactionType;
  status?: GCashTransactionStatus | "pending_only";
  start_date?: string;
  end_date?: string;
  borrower_id?: number;
  gcash_non_member_id?: number;
  page?: number;
  per_page?: number;
};

export type GCashTierInput = Omit<GCashTier, "id">;

/**
 * A walk-in customer who is not a coop member but transacts over the GCash
 * counter. Saved so repeat walk-ins don't have to be retyped every visit.
 */
export interface GCashNonMember {
  id: number;
  full_name: string;
  mobile_number: string;
  id_type: string;
  id_number: string;
  remarks?: string | null;
  transaction_count?: number;
  created_at: string;
  updated_at: string;
}

export type GCashNonMemberInput = {
  full_name: string;
  mobile_number: string;
  id_type: string;
  id_number: string;
  remarks?: string | null;
};

export type GCashNonMemberFilters = {
  search?: string;
  page?: number;
  per_page?: number;
};

/**
 * Whoever a GCash transaction is recorded for. The Cash In / Cash Out dialogs
 * take this instead of a borrower so both tabs can drive the same flow.
 */
export type GCashParty =
  | { kind: "member"; id: number; full_name: string; borrower_code?: string }
  | { kind: "non_member"; id: number; full_name: string; mobile_number?: string | null };
