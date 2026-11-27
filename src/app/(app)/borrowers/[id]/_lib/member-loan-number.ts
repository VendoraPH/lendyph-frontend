/**
 * Each loan's number on the member page's Loans tab (finish run round 8): the
 * server's `display_number` (its LN- number, else an imported loan's Loan No.
 * from the file, else its application number), read through the shared
 * `loanNumberLabel`, so an imported loan never reads as "LN-<id>". Pure, so it
 * runs under `tsx --test`.
 */

import { loanNumberLabel, type LoanNumberFields } from "@/lib/loan-number";

export function memberLoanNumber(loan: LoanNumberFields): string {
  return loanNumberLabel(loan);
}
