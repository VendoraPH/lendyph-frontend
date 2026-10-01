/**
 * The due figures the loans list (`LoanResource`) and `/loans/{id}/summary`
 * serve, and how they overlap:
 *
 * - `overdue_amount` is everything still owed on the LATE periods, their
 *   penalty included.
 * - `penalty_amount` is the penalty still owed on the whole loan. Penalty is
 *   only ever charged on a late period, so it is already inside
 *   `overdue_amount`.
 * - `current_due` is what is owed on the earliest unpaid period. When the loan
 *   is late, that period is a late one, so it is inside `overdue_amount` too.
 *
 * Adding any two of them counts the overlap twice: a late period of ₱11,800
 * with a ₱200 penalty read as ₱12,200 on the loan screen, and as ₱24,200 in
 * the Record Payment dialog.
 */
export interface LoanDueFigures {
  current_due?: number | null;
  overdue_amount?: number | null;
  penalty_amount?: number | null;
}

/** The loan screen's overdue card: what is late, penalty included. */
export function overdueWithPenalty(figures: LoanDueFigures): number {
  return figures.overdue_amount ?? 0;
}

/**
 * What is due now: everything that is late, or the next instalment when
 * nothing is.
 */
export function currentDues(figures: LoanDueFigures): number {
  const overdue = figures.overdue_amount ?? 0;
  return overdue > 0 ? overdue : (figures.current_due ?? 0);
}
