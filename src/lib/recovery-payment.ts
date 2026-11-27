/**
 * Payments on a defaulted loan ("recovery payments").
 *
 * A defaulted loan takes payments like a released or ongoing one: the same
 * preview, presets, allocation, receipt and journal, all from the server. A
 * part payment leaves it Defaulted; paid in full, it reads Completed. No new
 * penalty is charged while it is defaulted (round Y).
 *
 * Pure, so it runs under `tsx --test`.
 */
import { LOAN_STATUS } from "@/constants/loan-status";

/**
 * The statuses whose loan page offers Record Payment. `current` and `past_due`
 * are display values some older payloads sent as the status; the server still
 * decides whether a payment is accepted.
 */
const RECORD_PAYMENT_STATUSES: readonly string[] = [
  LOAN_STATUS.RELEASED,
  LOAN_STATUS.ONGOING,
  LOAN_STATUS.CURRENT,
  LOAN_STATUS.PAST_DUE,
  LOAN_STATUS.DEFAULTED,
];

/** Whether a loan in this status is offered Record Payment. */
export function canRecordPaymentOn(status: string | null | undefined): boolean {
  return !!status && RECORD_PAYMENT_STATUSES.includes(status);
}

/** Whether a payment on a loan in this status is a recovery payment. */
export function isRecoveryPayment(status: string | null | undefined): boolean {
  return status === LOAN_STATUS.DEFAULTED;
}

/** The note a payment dialog shows on a defaulted loan. */
export const RECOVERY_PAYMENT_NOTE =
  "Recovery payment: this loan stays Defaulted until it is paid in full. No new penalty is charged while it is defaulted.";
