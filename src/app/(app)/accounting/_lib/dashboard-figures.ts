import { signedCentavos } from "./signed-money";

/**
 * A server figure in centavos, or null when the server didn't send one.
 * Laravel's decimal cast can send a number as a string, so a numeric string
 * reads as its number; anything else is missing.
 */
export function centavosOrNull(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * ₱ with two decimals, a negative in parentheses; a missing figure shows a
 * dash, and zero shows ₱0.00.
 */
export function centavosOrDash(value: number | string | null | undefined): string {
  const centavos = centavosOrNull(value);
  return centavos === null ? "—" : signedCentavos(centavos);
}

/**
 * Whether the 1180 Loan Adjustments Clearing card shows "Needs review". The
 * server's flag alone decides it; the browser never reads the balance for it.
 */
export function clearingNeedsReview(flag: boolean | null | undefined): boolean {
  return flag === true;
}
