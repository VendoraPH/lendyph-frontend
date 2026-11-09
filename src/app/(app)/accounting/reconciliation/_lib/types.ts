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
}

export interface ReconciliationDetail extends Reconciliation {
  id: number;
  account_code: string | null;
  account_name: string | null;
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
