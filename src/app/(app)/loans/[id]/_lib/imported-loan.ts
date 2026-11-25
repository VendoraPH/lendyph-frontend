/**
 * A loan migrated in by Data Import, on its page (finish run, round 5): the
 * cooperative's own Loan No. from the file it came in (`external_loan_no`),
 * shown only when the server sent one. The Loans search finds it too.
 * Pure, so it runs under `tsx --test`.
 */
export const IMPORTED_LOAN_NO_LABEL = "Loan No. in the imported file";

/** The file's Loan No., or null on a loan that was not imported. */
export function importedLoanNo(loan: { external_loan_no?: string | null } | null | undefined): string | null {
  const value = loan?.external_loan_no;
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
