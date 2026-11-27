import type { Loan } from "@/types";
import { currencyOrDash, toNumber } from "@/lib/report-format";

/** The LoanResource field this cell reads that `Loan` does not declare. */
type LoanWithTotalOutstanding = Loan & { total_outstanding?: number | string | null };

/**
 * The member Loans tab's "Outstanding" cell: the server's `total_outstanding`
 * (everything owed, premium included). "Paid" only for a completed loan that
 * owes nothing: drafts, rejected and restructured loans owe 0 too without
 * having been paid, so they show ₱0.00. A dash when the server sent no
 * figure. The deprecated `outstanding_balance` (principal + premium) is never
 * read here.
 */
export function loanOutstandingCell(loan: Loan): string {
  const raw = (loan as LoanWithTotalOutstanding).total_outstanding;
  if (loan.status === "completed" && toNumber(raw) === 0) return "Paid";
  return currencyOrDash(raw);
}
