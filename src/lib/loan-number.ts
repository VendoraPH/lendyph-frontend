/**
 * The number a loan is shown by (finish run round 7). The server decides it
 * (`Loan::displayNumber()`) and sends it as `display_number` on loan rows, or
 * `loan_display_number` on a payment or an adjustment: the loan's own LN-
 * number, else an imported loan's Loan No. from the cooperative's file, else
 * its application number. A payload that doesn't carry it yet is read in the
 * same order here, so an imported loan, which has no LN- number, never reads
 * as "LN-<id>". Pure, so it runs under `tsx --test`.
 */

/** The fields a loan row may carry its number in. */
export interface LoanNumberFields {
  display_number?: string | null;
  loan_display_number?: string | null;
  loan_account_number?: string | null;
  external_loan_no?: string | null;
  application_number?: string | null;
}

function filled(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * The loan's number as shown: the server's `display_number` (or
 * `loan_display_number`), else its LN- number, the file's Loan No. and the
 * application number, in that order. `fallback` (default "—") only when the
 * row carries none of them; it is never a made-up loan number.
 */
export function loanNumberLabel(loan: LoanNumberFields | null | undefined, fallback = "—"): string {
  if (!loan) return fallback;

  for (const value of [
    loan.display_number,
    loan.loan_display_number,
    loan.loan_account_number,
    loan.external_loan_no,
    loan.application_number,
  ]) {
    if (filled(value)) return value;
  }

  return fallback;
}
