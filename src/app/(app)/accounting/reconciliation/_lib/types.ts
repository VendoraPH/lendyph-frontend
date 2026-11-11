import type {
  Reconciliation,
  ReconciliationActionResult,
  ReconciliationLine,
} from "@/types";

/**
 * The reconciliation exactly as `ReconciliationMatcher::present()` sends it.
 *
 * The shared `Reconciliation` and `ReconciliationLine` types (in
 * `src/types/accounting.ts`) carry no ids, counts or dates, though the backend
 * has always sent them. They are extended here rather than edited, because the
 * shared file belongs to the round C contracts slice. Money is integer
 * centavos; every figure and count is the server's.
 */

/** Which side a worksheet row stands for: the statement, the books, or a pair of both. */
export type ReconciliationRowSource = "statement" | "ledger" | "both";

export interface ReconciliationRow extends ReconciliationLine {
  /** The statement line's id; null on a row that is in the books only. */
  statement_line_id: number | null;
  /** The ledger line matched or suggested; null on a statement-only row. */
  journal_line_id: number | null;
  journal_no: string | null;
  source: ReconciliationRowSource;
  external_reference: string | null;
  /**
   * Exactly what `POST …/match` accepts by hand for this ledger line. Absent
   * from an API older than backend #257, where every books-only row is offered.
   */
  matchable?: boolean;
  /** The ledger entry is dated outside the period (an outstanding item); `date` is its own. */
  outside_period?: boolean;
  /**
   * On a paired row, the statement line's own date and amount (centavos);
   * `date` and `amount` are the books entry's. Absent from an API older than
   * backend f2c, where a paired row carries the books figures only.
   */
  statement_date?: string | null;
  statement_amount?: number | null;
  /**
   * An outstanding row whose reversal pair nets to zero, so it is left out of
   * `outstanding_count`. Absent from an API older than backend f2c.
   */
  netted?: boolean;
}

export interface ReconciliationDetail extends Reconciliation {
  id: number;
  account_code: string | null;
  account_name: string | null;
  /**
   * The branch whose journal lines it proves; null for "All branches". Absent
   * from an API older than backend #283.
   */
  branch_id?: number | null;
  /** The branch's name, or "All branches" when `branch_id` is null. */
  branch_name?: string | null;
  start_date: string;
  end_date: string;
  /** Centavos. */
  book_balance: number;
  /** Centavos. */
  statement_balance: number;
  /** Centavos, `book_balance - statement_balance`, worked out by the server. */
  difference: number;
  is_reconciled: boolean;
  matched_count: number;
  possible_count: number;
  unmatched_count: number;
  /**
   * Entries dated before the period that no statement line has matched yet
   * (deposits in transit, uncleared cheques). Absent from an API older than
   * backend #257.
   */
  outstanding_count?: number;
  notes: string | null;
  lines: ReconciliationRow[];
}

/** What C5's three line actions answer (201): the worksheet as GET answers it, and the record made. */
export interface ReconciliationActionAnswer
  extends Omit<ReconciliationActionResult, "data"> {
  data: ReconciliationDetail;
}

export type CreatedRecord = ReconciliationActionResult["created"];

/** One statement line as `StoreReconciliationRequest` takes it. */
export interface NewStatementLine {
  date: string;
  description: string;
  /** Centavos, signed: positive is money in. Never zero. */
  amount: number;
  external_reference?: string;
}

export interface CreateReconciliationBody {
  account_id: number;
  /** The branch whose entries it proves; null for "All branches" (view_all only). */
  branch_id: number | null;
  /** Left out when blank: the server names the period from the dates. */
  period?: string;
  start_date: string;
  end_date: string;
  /** Centavos, signed (an overdrawn account is negative). */
  statement_balance: number;
  lines: NewStatementLine[];
}

export type MatchReconciliationBody =
  | { matches: Array<{ line_id: number; journal_line_id: number | null }> }
  | { accept_suggestions: true };

/** The three things an unmatched statement line can be recorded as. */
export type LineActionKind = "expense" | "transfer" | "suspense";

/**
 * C5's review fix: an action on a line the books already hold is refused (422)
 * unless it is resent with `record_anyway: true`. Not in the shared body types.
 */
export interface RecordAnyway {
  record_anyway?: boolean;
}
