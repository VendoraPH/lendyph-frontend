import type { CreditDecision } from "@/types/credit-scoring";

/**
 * The loan a decision names, by its account number ("Loan LN-000004"), or
 * null for a member-level decision. An API that doesn't send
 * `loan_account_number` yet names none, rather than a loan's id.
 */
export function decisionLoanLabel(decision: Pick<CreditDecision, "loan_account_number">): string | null {
  const number = decision.loan_account_number?.trim();
  return number ? `Loan ${number}` : null;
}
