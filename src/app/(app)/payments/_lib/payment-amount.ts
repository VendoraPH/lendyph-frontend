/**
 * The payment amount a cashier typed, checked before anything is sent. The
 * server refuses an amount with more than two decimals (422 on the amount),
 * so the form says so as it is typed and sends neither the preview nor the
 * payment until it is fixed. `step="0.01"` alone does not stop it: the
 * browser still accepts the typed value. Pure, so it runs under `tsx --test`.
 */

/** What the form says under an amount with more than two decimals. */
export const CENTAVO_MESSAGE = "Enter the amount to the centavo (two decimals).";

export interface PaymentAmountCheck {
  /** The amount to send, or null when there is none yet or it can't be sent. */
  amount: number | null;
  /** The message to show under the field, or null when there is nothing to say. */
  error: string | null;
}

/**
 * The amount typed (the input's string, or a number already read from it).
 * Empty or unreadable is no amount yet, with no message: the form already
 * waits for one. Trailing zeros are fine ("1500.500" is ₱1,500.50).
 */
export function checkPaymentAmount(raw: string | number): PaymentAmountCheck {
  if (typeof raw === "string" && raw.trim() === "") return { amount: null, error: null };
  const value = Number(raw);
  if (!Number.isFinite(value)) return { amount: null, error: null };
  // toFixed(2) rounds to the nearest centavo; any figure it changes had more
  // than two decimals. Reading back the same double avoids float drift
  // (1.15 * 100 is 114.99999999999999).
  if (Number(value.toFixed(2)) !== value) return { amount: null, error: CENTAVO_MESSAGE };
  return { amount: value, error: null };
}
