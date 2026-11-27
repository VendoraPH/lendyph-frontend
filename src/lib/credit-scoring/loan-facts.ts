import type { BorrowerScoreFilters } from "@/types/credit-scoring";

/**
 * A member row's loan fact (`past_due`, `has_active_loan`). The server sends
 * it as null to a caller without loans:view, which reads a dash, never "No".
 */
export function yesNoOrDash(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value ? "Yes" : "No";
}

/**
 * The member list's filters as sent. Without loans:view the server answers
 * 422 to the past-due, active-loan and loan product filters, so they're never
 * sent then.
 */
export function borrowerScoreFilters(filters: BorrowerScoreFilters, canViewLoans: boolean): BorrowerScoreFilters {
  if (canViewLoans) return filters;
  const sent = { ...filters };
  delete sent.past_due;
  delete sent.has_active_loan;
  delete sent.loan_product_id;
  return sent;
}
