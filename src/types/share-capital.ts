/**
 * One row of `ShareCapitalLedgerResource`, exactly as the API sends it —
 * `GET /share-capital/ledger`, `POST /share-capital/ledger` and
 * `POST /pledges/{pledge}/entries` all answer with it.
 *
 * An entry is a pair of `debit` and `credit` columns, one of them 0. There is
 * no `type` or `amount` on the wire (those are request fields, see
 * `CreateLedgerEntryData`), and there never was: this interface used to
 * declare them, and every balance summed from it read 0.
 */
export interface ShareCapitalLedgerEntry {
  id: number;
  borrower_id: number;
  /** Both read through `borrower?->`, so nullable on the wire. */
  borrower_name: string | null;
  borrower_code: string | null;
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  /**
   * Sent whenever the relation is loaded, which every endpoint above does;
   * null when no creator is on record.
   */
  created_by_user?: { id: number; name: string } | null;
  created_at: string | null;
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

// `date` and `type` are required by `ShareCapitalManualEntryRequest` and
// `ShareCapitalBulkEntryRequest`; a request without them is a 422.
export interface CreatePledgeEntryData {
  amount: number;
  date: string;
  description?: string;
  type: "credit" | "debit";
}

export interface BulkPledgeEntryData {
  entries: {
    pledge_id: number;
    amount: number;
    date: string;
    description?: string;
    type: "credit" | "debit";
  }[];
}
