export interface ShareCapitalLedgerEntry {
  id: number;
  borrower_id: number;
  borrower_name?: string;
  borrower?: {
    id: number;
    full_name?: string;
    name?: string;
    member_id?: string;
  };
  date: string;
  description: string;
  reference?: string;
  type: "credit" | "debit";
  amount: number;
  created_at?: string;
  updated_at?: string;
}

export interface Pledge {
  id: number;
  borrower_id: number;
  borrower_name?: string;
  borrower?: {
    id: number;
    full_name?: string;
    name?: string;
    member_id?: string;
  };
  amount: number;
  schedule: string;
  auto_credit: boolean;
  total_credited?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AutoCreditStatus {
  active_members: AutoCreditMember[];
  disabled_members: AutoCreditMember[];
  no_pledge_members: AutoCreditMember[];
  total_amount: number;
  last_run_at?: string | null;
}

export interface AutoCreditMember {
  id: number;
  borrower_id: number;
  borrower_name?: string;
  borrower?: {
    id: number;
    full_name?: string;
    name?: string;
  };
  pledge_amount: number;
  auto_credit: boolean;
}

export interface AutoCreditProcessResult {
  processed_count: number;
  total_amount: number;
  processed_at: string;
}

export interface CreateLedgerEntryData {
  borrower_id: number;
  date: string;
  description: string;
  type: "credit" | "debit";
  amount: number;
}

export interface UpdatePledgeData {
  amount?: number;
  schedule?: string;
}

export interface CreatePledgeEntryData {
  amount: number;
  date?: string;
  description?: string;
  type?: "credit" | "debit";
}

export interface BulkPledgeEntryData {
  entries: {
    pledge_id: number;
    amount: number;
    date?: string;
    description?: string;
    type?: "credit" | "debit";
  }[];
}
