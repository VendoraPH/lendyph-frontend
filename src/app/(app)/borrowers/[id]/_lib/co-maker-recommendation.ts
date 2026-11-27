// When the borrower page recommends a co-maker for a loan. Dependency-free, so
// it runs under `tsx --test`.

import type { Loan } from "@/types/loan";

/** The principal from which a co-maker is recommended, in pesos. */
export const CO_MAKER_RECOMMENDED_FROM = 50000;

/**
 * Whether a loan is flagged as needing a co-maker: one of at least
 * `CO_MAKER_RECOMMENDED_FROM` that is not completed and has none linked.
 *
 * Read off the loan's own `co_makers`, what `GET /loans` lists for each row.
 * It used to be matched against the borrower's co-makers by a `loan_id` the
 * API never sends, so every such loan was flagged, co-maker or not.
 */
export function loanNeedsCoMaker(
  loan: Pick<Loan, "principal_amount" | "status" | "co_makers">,
): boolean {
  return (
    loan.principal_amount >= CO_MAKER_RECOMMENDED_FROM &&
    loan.status !== "completed" &&
    (loan.co_makers ?? []).length === 0
  );
}
