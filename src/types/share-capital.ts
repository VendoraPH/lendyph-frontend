import type { RecordPaymentMethod } from "@/constants/payment-methods";
import type { AutoCreditMethod } from "@/lib/payment-reference";

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
  /** How the money moved; a cash entry's is the server's CSH number. */
  reference_number?: string | null;
  /**
   * Brought over by Data Import's share capital file from the cooperative's
   * earlier books: it has no payment method and posted nothing to the books.
   */
  is_imported?: boolean;
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

/**
 * The half of the month a share capital auto-credit run is for (finish run
 * round 8): the 15th run credits "15" and "15/30" pledges, the 30th run "30"
 * and "15/30".
 */
export type AutoCreditCycle = "15" | "30";

export interface AutoCreditStatus {
  /** The half this preview is for: as asked, else by today in Manila. */
  cycle?: AutoCreditCycle;
  active_members: AutoCreditMember[];
  disabled_members: AutoCreditMember[];
  no_pledge_members: AutoCreditMember[];
  /** The pledges this half's run skips, each with the server's reason in words (finish run rounds 7 and 8). */
  skipped_members?: (AutoCreditMember & { reason: string })[];
  skipped_count?: number;
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
  /** The half of the month the run is for, required. */
  cycle: AutoCreditCycle;
  method?: AutoCreditMethod;
  reference_number?: string;
}

export interface AutoCreditProcessResult {
  processed_count: number;
  total_amount: number;
  processed_at: string;
  /** The half the run was for. */
  cycle?: AutoCreditCycle;
  /** The pledges the run skipped, each with the server's reason (finish run rounds 7 and 8). */
  skipped_count?: number;
  skipped?: { pledge_id: number; borrower_name: string | null; amount: number; reason: string }[];
}

/**
 * How a share capital entry's money came in or went out. `method` is cash when
 * left out; `reference_number` is required unless cash, at most 100
 * characters. A credit posts Dr the method's account / Cr 3060, a debit the
 * reverse.
 */
export interface ShareCapitalMethodFields {
  method?: RecordPaymentMethod;
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

/** `GET /share-capital/cash-reference/next`: the CSH number the next cash entry would get. */
export interface CashReferencePreview {
  reference_number: string;
}
