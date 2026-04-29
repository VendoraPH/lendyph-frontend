export interface Payment {
  id: number;
  loan_id: number;
  borrower_id: number;
  amount: number;
  penalty_amount?: number;
  method: "cash" | "bank_transfer" | "gcash" | "maya" | "online" | "auto_pay";
  status: "pending" | "completed" | "voided";
  reference_number?: string;
  remarks?: string;
  collected_by?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}
