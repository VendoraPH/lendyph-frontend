import type { CreateRepaymentData } from "@/types";

/** POST /loans/{loan}/repayments, with the fields `CreateRepaymentData` doesn't declare yet. */
export type PaymentBody = CreateRepaymentData & {
  method: string;
  /** Required unless the method is cash; the API refuses a missing one. */
  reference_number: string | null;
};

/**
 * The reference once the method changes: cleared, because a reference belongs to
 * the method it was typed for. Cash doesn't require one, so one typed for GCash
 * would otherwise go out on a Cash payment.
 */
export function referenceAfterMethodChange(
  previousMethod: string,
  nextMethod: string,
  reference: string,
): string {
  return previousMethod === nextMethod ? reference : "";
}

/**
 * What Post Payment sends. The method and reference are fields, so the
 * statement reads them and the journal posts to the method's account. Remarks
 * hold only what was typed, plus who collected it when that isn't the
 * signed-in user (the server records the signed-in user itself).
 */
export function buildPaymentBody(input: {
  paymentDate: string;
  amount: number;
  method: string;
  referenceNumber: string;
  remarks: string;
  collectedBy: string;
  signedInName: string;
}): PaymentBody {
  const collector = input.collectedBy.trim();
  const collectedByOther =
    collector !== "" && collector.toLowerCase() !== input.signedInName.trim().toLowerCase();
  const remarks = [input.remarks.trim(), collectedByOther ? `Collected by ${collector}` : ""]
    .filter((line) => line !== "")
    .join("\n");

  return {
    payment_date: input.paymentDate,
    amount_paid: input.amount,
    method: input.method,
    reference_number: input.referenceNumber.trim() || null,
    ...(remarks ? { remarks } : {}),
  };
}
