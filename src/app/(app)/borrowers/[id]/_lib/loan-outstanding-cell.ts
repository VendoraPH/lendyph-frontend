import type { Loan } from "@/types";
import { formatCurrency } from "@/lib/format";
import { DASH, toNumber } from "@/lib/report-format";

/** The LoanResource field this cell reads that `Loan` does not declare. */
type LoanWithTotalOutstanding = Loan & { total_outstanding?: number | string | null };

/**
 * The member Loans tab's "Outstanding" cell: the server's `total_outstanding`
 * (everything owed, premium included). "Paid" when nothing is owed, a dash
 * when the server sent no figure. The deprecated `outstanding_balance`
 * (principal + premium) is never read here.
 */
export function loanOutstandingCell(loan: Loan): string {
  const owed = toNumber((loan as LoanWithTotalOutstanding).total_outstanding);
  if (owed === null) return DASH;
  return owed > 0 ? formatCurrency(owed) : "Paid";
}
