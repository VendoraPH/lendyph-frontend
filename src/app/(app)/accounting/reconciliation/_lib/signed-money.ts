import { formatCentavos } from "@/lib/accounting/money";

/**
 * How the reconciliation screens write a signed server figure: ₱ with two
 * decimals, and a negative in parentheses, "(₱400.00)", as the accounting
 * statements do (lending screens keep "-₱"). The same output as the accounting
 * screens' shared `signedCentavos` in `accounting/_lib/signed-money.ts`, which
 * this can switch to once both are on development.
 *
 * Only the sign moves into parentheses; the figure itself is the server's.
 */
export function signedCentavos(centavos: number): string {
  return centavos < 0 ? `(${formatCentavos(centavos).replace("-", "")})` : formatCentavos(centavos);
}
