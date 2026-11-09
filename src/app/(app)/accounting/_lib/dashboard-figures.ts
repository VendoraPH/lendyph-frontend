import { formatCentavos } from "@/lib/accounting/money";

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

/** ₱ with two decimals; a missing figure shows a dash, and zero shows ₱0.00. */
export function centavosOrDash(value: number | string | null | undefined): string {
  const centavos = centavosOrNull(value);
  return centavos === null ? "—" : formatCentavos(centavos);
}
