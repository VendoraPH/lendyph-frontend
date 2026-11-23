import type { RepaymentPreview } from "@/services/repayment.service";
import { dueNowHasOpenPeriod, shouldPromptExtend } from "@/lib/payment-figures";
import { offersExtendOnPartialPayment } from "@/lib/partial-extend";
import type { ActiveLoan } from "./active-loans";

/**
 * What Post Payment does with the payment typed, as the loan page's Record
 * Payment does: `post` it; ask "Extend loan?" first (`prompt`) when the
 * server's dated preview calls it partial on a loan that can be extended; or
 * post nothing while that preview is on its way (`unknown`) or failed
 * (`failed`). `current` is the preview answering exactly this loan, amount and
 * date, null until it has. Any other loan posts as is, without waiting.
 */
export function postPaymentStep(
  loan: Pick<ActiveLoan, "is_one_month_term" | "status" | "amount_due_now">,
  current: { preview: RepaymentPreview | null; error: string | null } | null,
): "post" | "prompt" | "unknown" | "failed" {
  if (!offersExtendOnPartialPayment(loan)) return "post";
  return shouldPromptExtend({
    hasOpenPeriod: loan.amount_due_now === null || dueNowHasOpenPeriod(loan.amount_due_now),
    preview: current?.preview ?? null,
    previewIsCurrent: current !== null && current.error === null,
    previewFailed: current !== null && current.error !== null,
  });
}
