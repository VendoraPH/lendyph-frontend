/**
 * The "Extend loan?" prompt on a partial payment, on the loan page and on
 * Payment Entry: three buttons, one outcome each. Closing the prompt any
 * other way (Escape, a click outside) is Cancel.
 *
 * Pure, so it runs under `tsx --test`.
 */
import type { ExtendLoanPayload } from "@/services/loan.service";
import { formatCurrency } from "@/lib/format";
import { canRecordPaymentOn, isRecoveryPayment } from "@/lib/recovery-payment";

export type PartialExtendChoice = "cancel" | "record" | "extend";

/**
 * Whether a partial payment on this loan asks "Extend loan?" first. Only a
 * loan the server says can be extended does (`is_one_month_term`, the rule
 * behind the Extend Loan button, which the server works out from the loan's
 * original term), and never a defaulted one, whose payment is a recovery
 * payment. Any other loan's partial payment is recorded as is.
 */
export function offersExtendOnPartialPayment(
  loan: { is_one_month_term?: boolean | null; status?: string | null } | null | undefined,
): boolean {
  return (
    loan?.is_one_month_term === true &&
    canRecordPaymentOn(loan.status) &&
    !isRecoveryPayment(loan.status)
  );
}

/**
 * The member statuses the server refuses "defer" for: a former member
 * (Borrower::FORMER_MEMBER_STATUSES) gets no new credit, and deferring moves
 * the unpaid interest into a new period (ExtendLoanRequest). Paying the
 * interest to extend stays allowed, from Extend Loan.
 */
const DEFER_REFUSED_MEMBER_STATUSES: readonly string[] = ["withdrawn", "deceased"];

/**
 * Why "Yes, extend", which always defers, can't be used on this loan, in
 * words; null when it can. Read from the member's status on the loan, which
 * the server sends only to a caller who may read the member in full; without
 * it the server decides, and refuses in its own words.
 */
export function partialExtendDeferRefusal(memberStatus: unknown): string | null {
  return typeof memberStatus === "string" && DEFER_REFUSED_MEMBER_STATUSES.includes(memberStatus)
    ? "A withdrawn or deceased member can't extend by deferring the interest."
    : null;
}

/**
 * What "Yes, extend" sends once the payment is recorded: "defer", because the
 * cashier's payment has just been posted and the server must not collect the
 * interest again (whatever is still unpaid carries into the new period), and
 * a remark naming that payment in pesos.
 */
export function partialExtendPayload(amountPaid: number): ExtendLoanPayload {
  return {
    remarks: `Auto-extend on partial payment of ${formatCurrency(amountPaid)}`,
    interest_option: "defer",
  };
}

export interface PartialExtendOutcome {
  /** Record the payment the cashier entered. */
  recordPayment: boolean;
  /** Extend the loan after recording it. */
  extend: boolean;
}

export const PARTIAL_EXTEND_LABELS: Record<PartialExtendChoice, string> = {
  cancel: "Cancel",
  record: "Record partial payment",
  extend: "Yes, extend",
};

export function partialExtendOutcome(choice: PartialExtendChoice): PartialExtendOutcome {
  switch (choice) {
    case "cancel":
      return { recordPayment: false, extend: false };
    case "record":
      return { recordPayment: true, extend: false };
    case "extend":
      return { recordPayment: true, extend: true };
  }
}

/** The prompt closing on its own (Escape, outside click) is Cancel; opening needs no choice. */
export function partialExtendOnOpenChange(open: boolean): PartialExtendChoice | null {
  return open ? null : "cancel";
}

/**
 * Runs the choice on the pending payment: Cancel runs nothing, "Record
 * partial payment" only records it, "Yes, extend" records it and extends.
 * Nothing runs when no payment is pending.
 */
export async function dispatchPartialExtend<P>(
  choice: PartialExtendChoice,
  payment: P | null,
  actions: { record: (payment: P) => Promise<unknown>; recordAndExtend: (payment: P) => Promise<unknown> },
): Promise<void> {
  const outcome = partialExtendOutcome(choice);
  if (payment === null || !outcome.recordPayment) return;
  if (outcome.extend) await actions.recordAndExtend(payment);
  else await actions.record(payment);
}
