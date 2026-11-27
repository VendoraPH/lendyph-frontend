import { formatCentavos } from "@/lib/accounting/money";

/**
 * How an accounting screen writes a signed server figure: ₱ with two decimals,
 * and a negative in parentheses, "(₱400.00)", as the statements already do.
 * Lending screens keep "-₱" (`formatCentavos`).
 *
 * Only the sign moves into parentheses; the figure itself is the server's.
 */
export function signedCentavos(centavos: number): string {
  return centavos < 0 ? `(${formatCentavos(centavos).replace("-", "")})` : formatCentavos(centavos);
}

/**
 * `signedCentavos` for a figure the server may not have sent: a missing one
 * reads as a dash, never ₱0.00. Laravel's decimal cast can send a number as a
 * string, so a numeric string reads as its number.
 */
export function signedCentavosOrDash(value: number | string | null | undefined): string {
  const centavos =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(centavos) ? signedCentavos(centavos) : "—";
}
