/**
 * A peso amount typed into a form, read exactly as typed.
 *
 * Input only: this checks and tidies what was typed and never adds, subtracts
 * or derives money. The figure typed is the figure sent, to the centavo.
 * Anything finer than a centavo is refused with a message rather than rounded
 * (the server refuses it too, 422), and anything that isn't plain pesos
 * (blank, negative, "1,500", "1e3", "₱100") is refused as not an amount.
 */

export type ParsedAmount =
  | {
      ok: true;
      /** The amount as a number, for comparisons and number inputs. */
      amount: number;
      /** The amount as text with two decimals ("1500.00"), built without arithmetic. */
      value: string;
    }
  | { ok: false; message: string };

/** Plain pesos as a number input gives them: digits, then an optional fraction. */
const PESOS = /^(\d+)(?:\.(\d+))?$/;

export function tooPreciseMessage(label: string): string {
  return `${label} can't have more than two decimals (centavos).`;
}

/** The fraction typed, without trailing zeros: "1500.550" has "55". */
function significantFraction(fraction: string | undefined): string {
  return (fraction ?? "").replace(/0+$/, "");
}

/**
 * Plain pesos typed with more than two decimals that aren't trailing zeros.
 * "1500.550" is not extra precision; "1500.555" is.
 */
export function isTooPrecise(raw: string): boolean {
  const match = PESOS.exec(raw.trim());
  return match !== null && significantFraction(match[2]).length > 2;
}

export interface MoneyInputOptions {
  /** What the field is called in the message ("Deposit amount"). */
  label?: string;
  /** Accept ₱0.00 (for example an initial deposit a product doesn't require). */
  allowZero?: boolean;
}

/**
 * The typed amount, exactly, or why it can't be used. Blank, negative and
 * anything that isn't plain pesos are refused as "must be more than ₱0.00"
 * (or "must be ₱0.00 or more" when zero is allowed).
 */
export function parseMoneyInput(
  raw: string,
  { label = "Amount", allowZero = false }: MoneyInputOptions = {},
): ParsedAmount {
  const refused = allowZero ? `${label} must be ₱0.00 or more` : `${label} must be more than ₱0.00`;
  const match = PESOS.exec(raw.trim());
  if (!match) return { ok: false, message: refused };

  const fraction = significantFraction(match[2]);
  if (fraction.length > 2) return { ok: false, message: tooPreciseMessage(label) };

  const pesos = match[1].replace(/^0+(?=\d)/, "");
  const value = `${pesos}.${fraction.padEnd(2, "0")}`;
  const amount = Number(value);
  if (!allowZero && amount === 0) return { ok: false, message: refused };
  return { ok: true, amount, value };
}
