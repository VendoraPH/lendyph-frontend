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
 * When at least one is a figure, the receipt shows the split: each row only
 * above ₱0.00, and a null beside a figure reads a dash. When both are null
 * (the server can't tell the parts apart, as on an old build-up payment) or
 * both are missing (an older backend), the receipt keeps the one combined
 * line it always printed, the server's own `overpayment` (alias
 * `excess_amount`), under a neutral label, so no money drops off the
 * breakdown. Nothing here is worked out: every figure is shown as sent.
 */
import { pickNumber } from "@/lib/api-payload";
import { DASH, currencyOrDash, toNumber } from "@/lib/report-format";

export const BUILD_UP_LABEL = "Share Capital Build-Up";
export const OVERPAYMENT_LABEL = "Advance / Overpayment";
/** The combined line when the server sent no split. */
export const COMBINED_LABEL = "Build-Up / Overpayment";

const FIELDS = [
  { key: "build_up_credited", label: BUILD_UP_LABEL },
  { key: "overpayment_kept", label: OVERPAYMENT_LABEL },
] as const;

export interface ReceiptExtraLine {
  label: string;
  /** "₱250.00", or a dash when the server sent null beside the other figure. */
  amount: string;
}

type Payment = Record<string, unknown> | null | undefined;

/** Whether the server split the excess: at least one of the two is a figure, not null. */
export function hasReceiptSplit(payment: Payment): boolean {
  return payment != null && FIELDS.some(({ key }) => key in payment && payment[key] !== null && payment[key] !== undefined);
}

function aboveZero(value: number | null): value is number {
  return value !== null && Math.round(value * 100) > 0;
}

export function receiptExtraLines(payment: Payment): ReceiptExtraLine[] {
  if (payment == null) return [];
  if (!hasReceiptSplit(payment)) {
    const combined = pickNumber(payment, ["overpayment", "excess_amount"]);
    return aboveZero(combined) ? [{ label: COMBINED_LABEL, amount: currencyOrDash(combined) }] : [];
  }
  const lines: ReceiptExtraLine[] = [];
  for (const { key, label } of FIELDS) {
    if (!(key in payment) || payment[key] === undefined) continue;
    const value = payment[key];
    if (value === null) {
      lines.push({ label, amount: DASH });
      continue;
    }
    const n = toNumber(value);
    if (aboveZero(n)) lines.push({ label, amount: currencyOrDash(n) });
  }
  return lines;
}
