import type { ShareCapitalLedgerEntry, ShareCapitalMemberPeriod } from "@/types";
import { ledgerAmounts } from "@/utils/share-capital";

export interface ShareCapitalTabRow {
  id: number;
  date: string;
  description: string;
  debit: number;
  credit: number;
  /** The server's balance after this entry; null when it sent none. */
  runningBalance: number | null;
}

/** The server's figures for the whole ledger; null when it sent no summary. */
export interface ShareCapitalTabTotals {
  totalCredits: number | null;
  totalDebits: number | null;
  balance: number | null;
}

/**
 * The member Share Capital tab's rows and totals, straight from
 * `GET /share-capital/ledger?borrower_id=`: each row's `running_balance` and
 * the `meta.summary` figures. Nothing is added up here, so the figures hold
 * even when the list itself is short.
 *
 * The server lists newest first (date, then id); the tab reads oldest first,
 * so the order is reversed rather than re-sorted.
 */
export function shareCapitalTabView(
  entries: readonly ShareCapitalLedgerEntry[],
  summary: ShareCapitalMemberPeriod | null,
): { rows: ShareCapitalTabRow[]; totals: ShareCapitalTabTotals } {
  const rows = [...entries].reverse().map((e) => ({
    id: e.id,
    date: e.date,
    description: e.description,
    ...ledgerAmounts(e),
    runningBalance: e.running_balance ?? null,
  }));
  return {
    rows,
    totals: {
      totalCredits: summary?.total_credits ?? null,
      totalDebits: summary?.total_debits ?? null,
      balance: summary?.ending_balance ?? null,
    },
  };
}
