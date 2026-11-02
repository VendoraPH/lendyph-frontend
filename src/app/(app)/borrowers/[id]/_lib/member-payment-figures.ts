import type { BorrowerLoanSummary } from "@/types";
import { currencyOrDash } from "@/lib/report-format";

/**
 * The member Payments tab's cards, read from GET /borrowers/{id}/loan-summary:
 * Outstanding is everything owed (`total_outstanding`), Overdue is only the
 * part that is past due (`overdue_amount`), and Total Paid is the server's
 * `total_paid`. Nothing is added up from the loans or payments here; a figure
 * the server did not send shows a dash.
 */
export function memberPaymentFigures(summary: BorrowerLoanSummary | null): {
  totalPaid: string;
  outstanding: string;
  overdue: string;
} {
  return {
    totalPaid: currencyOrDash(summary?.total_paid),
    outstanding: currencyOrDash(summary?.total_outstanding),
    overdue: currencyOrDash(summary?.overdue_amount),
  };
}
