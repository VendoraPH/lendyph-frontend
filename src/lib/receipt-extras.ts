/**
 * A payment receipt's Share Capital Build-Up and Advance / Overpayment rows,
 * on screen and printed (carried over from #451 by Augustin).
 *
 * The server sends both figures on the repayment (backend B-FU), as 2-decimal
 * strings or null:
 * - `build_up_credited`: what the payment credited to the member's share
 *   capital build-up;
 * - `overpayment_kept`: what it kept as an advance.
 *
 * Each row shows only when its figure is above ₱0.00; a null reads a dash.
 * An older backend sends neither field, and no row is added. Nothing here
 * is worked out: the figures are shown as sent.
 */
import { DASH, currencyOrDash, toNumber } from "@/lib/report-format";

export const BUILD_UP_LABEL = "Share Capital Build-Up";
export const OVERPAYMENT_LABEL = "Advance / Overpayment";

const FIELDS = [
  { key: "build_up_credited", label: BUILD_UP_LABEL },
  { key: "overpayment_kept", label: OVERPAYMENT_LABEL },
] as const;

export interface ReceiptExtraLine {
  label: string;
  /** "₱250.00", or a dash when the server sent null. */
  amount: string;
}

type Payment = Record<string, unknown> | null | undefined;

/** Whether the server sent the split at all (either field, null included). */
export function hasReceiptSplit(payment: Payment): boolean {
  return payment != null && FIELDS.some(({ key }) => key in payment);
}

export function receiptExtraLines(payment: Payment): ReceiptExtraLine[] {
  if (payment == null) return [];
  const lines: ReceiptExtraLine[] = [];
  for (const { key, label } of FIELDS) {
    if (!(key in payment)) continue;
    const value = payment[key];
    if (value === null) {
      lines.push({ label, amount: DASH });
      continue;
    }
    const n = toNumber(value);
    if (n !== null && n > 0) lines.push({ label, amount: currencyOrDash(n) });
  }
  return lines;
}
