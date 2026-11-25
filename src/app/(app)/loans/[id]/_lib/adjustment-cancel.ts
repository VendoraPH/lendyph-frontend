/**
 * Cancelling an approved adjustment that isn't applied yet (finish run,
 * round 6): who is offered Cancel, what its dialog asks, and how a cancelled
 * adjustment reads on the loan page. The server decides (`can_cancel`) and
 * refuses anything else in words; the page only shows it.
 *
 * Pure, so it runs under `tsx --test`.
 */
import { formatDateTime } from "@/lib/format";
import type { DecisionDialogCopy } from "./decision-dialogs";

/** The reason the server keeps: 5 to 500 characters, trimmed. */
export const ADJUSTMENT_CANCEL_REASON_MAX = 500;

interface CancellableAdjustment {
  status: string;
  can_cancel?: boolean | null;
}

/**
 * Cancel shows on an approved adjustment the server says can be cancelled,
 * to a user holding `loan_adjustments:approve`.
 */
export function offersCancel(adjustment: CancellableAdjustment, holdsApprove: boolean): boolean {
  return holdsApprove && adjustment.status === "approved" && adjustment.can_cancel === true;
}

/** The Cancel dialog, naming the adjustment by its type's label ("adjustment" without one). */
export function cancelAdjustmentDialog(typeLabel: string | undefined): DecisionDialogCopy {
  const what = (typeLabel ?? "adjustment").toLowerCase();
  return {
    title: `Cancel this ${what}?`,
    description: "It was approved but not applied. Once cancelled it can't be applied, and nothing on the loan changes.",
    confirmLabel: "Cancel Adjustment",
    reasonLabel: "Reason",
    reasonRequired: true,
    destructive: true,
  };
}

interface CancelledAdjustment {
  status: string;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  cancelled_by_user?: { id: number; name?: string | null } | null;
}

/**
 * How a cancelled adjustment reads: who cancelled it and when, then the
 * reason. Null for any other status. A part the server didn't send is left
 * out rather than guessed.
 */
export function cancellationLine(adjustment: CancelledAdjustment): string | null {
  if (adjustment.status !== "cancelled") return null;
  const who = adjustment.cancelled_by_user?.name?.trim();
  const when = adjustment.cancelled_at ? formatDateTime(serverTime(adjustment.cancelled_at)) : null;
  const by = ["Cancelled", who ? `by ${who}` : null, when ? `on ${when}` : null].filter(Boolean).join(" ");
  const reason = adjustment.cancellation_reason?.trim();
  return reason ? `${by}: ${reason}` : by;
}

/** A server time with no zone ("2026-11-25 14:05:00") is Manila time. */
function serverTime(value: string): string {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value) ? `${value.replace(" ", "T")}+08:00` : value;
}
