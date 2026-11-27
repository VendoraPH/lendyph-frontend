import type { Loan } from "@/types";
import { isEverReleasedLoanStatus } from "@/constants/loan-status";

/**
 * The loan whose saved schedule the Loans tab reads as it opens a row, or
 * null. Only a released loan has one; before release the server answers 422.
 * A schedule already read is not read again.
 */
export function scheduleToRead(
  loans: readonly Pick<Loan, "id" | "status">[],
  expandedLoanId: number | null,
  read: Readonly<Record<number, unknown>>,
): number | null {
  const loan = loans.find((l) => l.id === expandedLoanId);
  if (!loan || !isEverReleasedLoanStatus(loan.status)) return null;
  return Object.hasOwn(read, loan.id) ? null : loan.id;
}
