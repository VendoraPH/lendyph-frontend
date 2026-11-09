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
  /**
   * The member's balance after this entry, over all of the member's entries in
   * posting order (date, then id), whatever the list's filters. Sent by
   * `GET /share-capital/ledger`; absent on a just-created entry.
   */
  running_balance?: number;
}

/** `meta.summary` of `GET /share-capital/ledger?borrower_id=`: one member's period figures. */
export interface ShareCapitalMemberPeriod {
  opening_balance: number;
  total_credits: number;
  total_debits: number;
  ending_balance: number;
}

/** One row of `GET /share-capital/members`: a member's totals over every entry. */
export interface ShareCapitalMember {
  borrower_id: number;
  borrower_code: string | null;
  full_name: string | null;
  total_credits: number;
  total_debits: number;
  balance: number;
  entry_count: number;
  last_transaction_date: string | null;
}

export interface ShareCapitalBookTotals {
  member_count: number;
  total_credits: number;
  total_debits: number;
  balance: number;
}

/**
 * `GET /share-capital/members`: a page of members, `meta.totals` over the
 * whole book and `meta.matching_totals` over the members matching `search`.
 */
export interface ShareCapitalMembersResponse {
  data: ShareCapitalMember[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    totals: ShareCapitalBookTotals;
    matching_totals: ShareCapitalBookTotals;
  };
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

/**
 * `POST /auto-credit/process`: the settlement account the run is credited
 * through (Bank, `bank_transfer`, when left out) and an optional reference.
 */
export interface AutoCreditProcessData {
  method?: "cash" | "gcash" | "maya" | "bank_transfer";
  reference_number?: string;
}

export interface AutoCreditProcessResult {
  processed_count: number;
  total_amount: number;
  processed_at: string;
}

/**
 * How a share capital entry's money came in or went out. `method` is cash when
 * left out; `reference_number` is required unless cash, at most 100
 * characters. A credit posts Dr the method's account / Cr 3060, a debit the
 * reverse.
 */
export interface ShareCapitalMethodFields {
  method?: "cash" | "gcash" | "maya" | "bank_transfer" | "online";
  reference_number?: string;
}

export interface CreateLedgerEntryData extends ShareCapitalMethodFields {
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
export interface CreatePledgeEntryData extends ShareCapitalMethodFields {
  amount: number;
  date: string;
  description?: string;
  type: "credit" | "debit";
}

/** One method and reference for the whole batch. */
export interface BulkPledgeEntryData extends ShareCapitalMethodFields {
  entries: {
    pledge_id: number;
    amount: number;
    date: string;
    description?: string;
    type: "credit" | "debit";
  }[];
}
