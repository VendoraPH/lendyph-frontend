import { signedCentavos } from "./signed-money";

/**
 * How a statement figure reads. Centavos in, ₱ with two decimals out, and
 * negatives in parentheses, as accountants expect a contra or a loss.
 *
 * A figure the server didn't send reads as a dash, never ₱0.00: zero is a
 * real answer, and a missing one must not pass for it.
 */
export function amountDisplay(value: number | null | undefined): {
  text: string;
  negative: boolean;
} {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { text: "—", negative: false };
  }
  return { text: signedCentavos(value), negative: value < 0 };
}
