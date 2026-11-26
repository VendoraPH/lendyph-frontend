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

/**
 * Whether the loan came in by Data Import: the server's `is_imported`, else
 * (an older payload) a Loan No. from the file.
 */
export function isImportedLoan(
  loan: { is_imported?: boolean | null; external_loan_no?: string | null } | null | undefined,
): boolean {
  if (typeof loan?.is_imported === "boolean") return loan.is_imported;
  return importedLoanNo(loan) !== null;
}

/**
 * The approval card's note for an imported loan (finish run round 7): it was
 * approved in the cooperative's own records before it came in, so it has no
 * approval chain here. It replaces "Approval chain unavailable", which read as
 * if something were missing.
 */
export const IMPORTED_APPROVAL_TITLE = "Imported from the cooperative's records";

export function importedApprovalNote(loan: { external_loan_no?: string | null } | null | undefined): string {
  const loanNo = importedLoanNo(loan);
  return `This loan was imported from the cooperative's records${loanNo === null ? "" : ` (Loan No. ${loanNo})`}, so it has no approval chain in Lendy. It was approved before it was imported.`;
}
