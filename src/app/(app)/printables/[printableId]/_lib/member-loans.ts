/**
 * One member's loans for the printable picker. A member holds a handful, so all
 * of them come back and the table's tabs can count them. `view=summary` carries
 * every figure the table shows, without the schedules.
 */
export function memberLoanParams(borrowerId: number): Record<string, unknown> {
  return { borrower_id: borrowerId, view: "summary" };
}
