/**
 * What the loan page's reason dialogs ask, in words: voiding a payment, and
 * approving or rejecting a pending adjustment. They replaced the browser's
 * own prompt boxes.
 *
 * Pure, so it runs under `tsx --test`.
 */
import { formatCurrency } from "@/lib/format";
import { toNumber } from "@/lib/report-format";
import { repaymentRefNo } from "./ledger-rows";

/** The longest void reason (`void_reason`) and adjustment remark the server keeps (`max:1000`). */
export const LOAN_DECISION_NOTE_MAX = 1000;

/** The words and rules of one ReasonDialog. */
export interface DecisionDialogCopy {
  title: string;
  description: string;
  confirmLabel: string;
  reasonLabel: string;
  reasonRequired: boolean;
  destructive: boolean;
}

/**
 * Voiding a payment. The server requires a reason, so the dialog does too.
 * The payment is named by its receipt and amount when the page has it.
 */
export function voidPaymentDialog(
  payment: { id: number; receipt_number?: string | null; amount_paid?: unknown } | undefined,
): DecisionDialogCopy {
  const amount = payment === undefined ? null : toNumber(payment.amount_paid);
  const which =
    payment === undefined
      ? "This payment"
      : `Receipt ${repaymentRefNo(payment)}${amount === null ? "" : ` (${formatCurrency(amount)})`}`;
  return {
    title: "Void this payment?",
    description: `${which} will be voided. This can't be undone, and what it paid is owed again.`,
    confirmLabel: "Void Payment",
    reasonLabel: "Reason",
    reasonRequired: true,
    destructive: true,
  };
}

/**
 * Approving or rejecting a pending adjustment, named by its type's label
 * ("adjustment" without one). The server takes remarks as optional on both;
 * a rejection keeps the remark the old prompt box asked for, so the requester
 * reads why.
 */
export function adjustmentDecisionDialog(
  action: "approve" | "reject",
  typeLabel: string | undefined,
): DecisionDialogCopy {
  const what = (typeLabel ?? "adjustment").toLowerCase();
  return action === "approve"
    ? {
        title: `Approve this ${what}?`,
        description: "Once approved, it can be applied to the loan.",
        confirmLabel: "Approve",
        reasonLabel: "Remarks",
        reasonRequired: false,
        destructive: false,
      }
    : {
        title: `Reject this ${what}?`,
        description: "It won't be applied to the loan.",
        confirmLabel: "Reject",
        reasonLabel: "Remarks",
        reasonRequired: true,
        destructive: true,
      };
}
