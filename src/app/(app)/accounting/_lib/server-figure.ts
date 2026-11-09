import { formatCentavos } from "@/lib/accounting/money";

/**
 * A figure the server sent, in ₱ with two decimals. Zero reads ₱0.00; only a
 * figure the server didn't send reads as a dash, never as a browser sum.
 */
export function centavosOrDash(centavos: number | null | undefined): string {
  return centavos == null ? "—" : formatCentavos(centavos);
}
