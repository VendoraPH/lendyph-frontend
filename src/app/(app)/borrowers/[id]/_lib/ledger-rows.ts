import { formatCurrency } from "@/lib/format";
import type { BorrowerLedgerEntry } from "@/types";

export interface LedgerRowCells {
  reference: string;
  debit: string;
  credit: string;
}

/**
 * One member ledger row as the Ledger tab prints it, from the figures
 * GET /borrowers/{id}/ledger sends: a release carries its principal in
 * `debit`, a payment the amount paid in `credit`, and the side a row doesn't
 * use is 0, which reads "—". Nothing here adds or subtracts.
 */
export function ledgerRowCells(entry: BorrowerLedgerEntry): LedgerRowCells {
  return {
    reference: entry.reference || "—",
    debit: entry.debit ? formatCurrency(entry.debit) : "—",
    credit: entry.credit ? formatCurrency(entry.credit) : "—",
  };
}
