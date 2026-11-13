import { LOAN_STATUS, isActiveLoanStatus, isCollectibleLoanStatus } from "@/constants";

/**
 * One member's loans for the printable picker. A member holds a handful, so all
 * of them come back and the table's tabs can count them. `view=summary` carries
 * every figure the table shows, without the schedules.
 */
export function memberLoanParams(borrowerId: number): Record<string, unknown> {
  return { borrower_id: borrowerId, view: "summary" };
}

/** The picker's tabs, by loan status; "all" lists every loan. */
export type LoanPickerTab = "active" | "not_released" | "closed";
export type LoanPickerFilter = LoanPickerTab | "all";

export const LOAN_PICKER_TABS: readonly { key: LoanPickerFilter; label: string; empty: string }[] = [
  { key: "active", label: "Active", empty: "No active or defaulted loans for this member." },
  { key: "not_released", label: "Not yet released", empty: "No loans waiting for release for this member." },
  { key: "closed", label: "Closed", empty: "No closed loans for this member." },
  { key: "all", label: "All", empty: "This member has no loans on file." },
];

const NOT_RELEASED: ReadonlySet<string> = new Set([
  LOAN_STATUS.DRAFT,
  LOAN_STATUS.FOR_REVIEW,
  LOAN_STATUS.APPROVED,
]);

/**
 * Which tab a loan is listed under. A draft, a loan still for approval and an
 * approved loan waiting for release have their own tab, so they never read as
 * Closed. Active is the collectible loans (COLLECTIBLE_LOAN_STATUSES), a
 * defaulted loan included: it is still owed and the usual subject of a demand
 * letter. `isActiveLoanStatus` adds the old spellings (`current`, `past_due`)
 * that older payloads carry. Everything else (finished, rejected, void) is
 * Closed.
 */
export function loanPickerTab(status: string | null | undefined): LoanPickerTab {
  if (isCollectibleLoanStatus(status) || isActiveLoanStatus(status)) return "active";
  if (status && NOT_RELEASED.has(status)) return "not_released";
  return "closed";
}

export function loanPickerCounts(
  loans: readonly { status?: string | null }[],
): Record<LoanPickerFilter, number> {
  const counts: Record<LoanPickerFilter, number> = { active: 0, not_released: 0, closed: 0, all: loans.length };
  for (const loan of loans) counts[loanPickerTab(loan.status)] += 1;
  return counts;
}
