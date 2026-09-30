/** The balances the Ledger's running columns start from. Null is unknown. */
export interface LedgerOpening {
  principal: number;
  interest: number | null;
  scb: number | null;
}

/** What one Ledger row moves. */
interface LedgerMovement {
  principalPaid?: number;
  interestDebit?: number;
  interestCredit?: number;
  scbPaid?: number;
}

/** The running balances after one Ledger row. Null while its opening is unknown. */
export interface LedgerBalances {
  principalBal: number;
  interestBal: number | null;
  scbBal: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Where the Ledger's running balances start.
 *
 * Principal starts at the loan's principal, a server fact whatever the
 * schedule holds. Interest and SCB start from figures only the server's
 * schedule rows carry, so with none on screen — still loading, not readable,
 * or none left, as on a restructured loan whose open periods its restructure
 * deleted — their openings are unknown and come back null. Walking from 0
 * instead drove a restructured loan's Interest balance negative with every
 * interest collection.
 *
 * With rows, Interest opens at the figure that makes the last row land on
 * `currentInterestDue`, what the schedule says is still owed:
 *
 *   opening = currentInterestDue − debits + credits + interest paid
 *
 * and SCB at the schedule's build-up total.
 */
export function ledgerOpening({
  principalAmount,
  scheduleRowCount,
  currentInterestDue,
  scheduleScbTotal,
  interestDebits,
  interestCredits,
  interestPaid,
}: {
  principalAmount: number;
  /** Schedule rows on screen: 0 while loading, when unreadable, or when empty. */
  scheduleRowCount: number;
  currentInterestDue: number | null;
  scheduleScbTotal: number;
  interestDebits: number;
  interestCredits: number;
  interestPaid: number;
}): LedgerOpening {
  const hasSchedule = scheduleRowCount > 0;
  return {
    principal: principalAmount,
    interest:
      hasSchedule && currentInterestDue !== null
        ? round2(currentInterestDue - interestDebits + interestCredits + interestPaid)
        : null,
    scb: hasSchedule ? scheduleScbTotal : null,
  };
}

/**
 * The Ledger's rows, in order, with the running balance after each. Interest
 * walks both ways (a debit raises it, a credit or repayment lowers it);
 * Principal and SCB only go down. An unknown opening stays unknown on every
 * row, while the row's own amounts are left as they are.
 */
export function walkLedgerBalances<T extends LedgerMovement>(
  rows: readonly T[],
  opening: LedgerOpening,
): (T & LedgerBalances)[] {
  let principalBal = opening.principal;
  let interestBal = opening.interest;
  let scbBal = opening.scb;
  return rows.map((row) => {
    principalBal = Math.max(0, principalBal - (row.principalPaid ?? 0));
    scbBal = scbBal === null ? null : Math.max(0, scbBal - (row.scbPaid ?? 0));
    interestBal =
      interestBal === null ? null : round2(interestBal + (row.interestDebit ?? 0) - (row.interestCredit ?? 0));
    return { ...row, principalBal, interestBal, scbBal };
  });
}
