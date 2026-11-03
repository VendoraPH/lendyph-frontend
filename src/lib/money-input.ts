/**
 * Peso amounts typed into a form, read exactly as typed.
 *
 * The figure typed is the figure sent, to the centavo. Anything finer than a
 * centavo is refused with a message rather than rounded (the API refuses it
 * too, 422), and anything that isn't plain pesos — blank, negative, "1,500",
 * "1e3" — is refused as not an amount.
 */

export type ParsedAmount =
  | { ok: true; amount: number }
  | { ok: false; message: string };

/** Plain pesos as a number input gives them: digits, an optional fraction. */
const PESOS = /^\d+(?:\.(\d+))?$/;

export function tooPreciseMessage(label: string): string {
  return `${label} can't have more than two decimals (centavos).`;
}

/**
 * Plain pesos typed with more than two decimals that aren't trailing zeros.
 * "1500.550" is not extra precision; "1500.555" is.
 */
export function isTooPrecise(raw: string): boolean {
  const match = PESOS.exec(raw.trim());
  return match !== null && (match[1] ?? "").replace(/0+$/, "").length > 2;
}

export interface MoneyInputOptions {
  /** What the field is called in the message ("Deposit amount"). */
  label?: string;
  /** Accept 0 (e.g. an initial deposit a product does not require). */
  allowZero?: boolean;
}

/**
 * The typed amount, exactly, or why it can't be used. Blank, negative and
 * anything that isn't plain pesos are refused as "must be greater than 0"
 * (or "must be 0 or more" when zero is allowed).
 */
export function parseMoneyInput(
  raw: string,
  { label = "Amount", allowZero = false }: MoneyInputOptions = {},
): ParsedAmount {
  if (isTooPrecise(raw)) return { ok: false, message: tooPreciseMessage(label) };
  const match = PESOS.exec(raw.trim());
  if (!match) {
    return {
      ok: false,
      message: allowZero ? `${label} must be 0 or more` : `${label} must be greater than 0`,
    };
  }
  const amount = Number(match[0]);
  if (!allowZero && !(amount > 0)) {
    return { ok: false, message: `${label} must be greater than 0` };
  }
  return { ok: true, amount };
}
