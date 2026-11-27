import { formatCurrency } from "@/lib/format";
import { formatCount } from "@/lib/report-format";

/**
 * How a CDA screen shows a server figure. Money is ₱ with two decimals and a
 * negative in parentheses, "(₱400.00)", as CDA's financial pages and exports
 * write it; a figure the server didn't send reads as a dash. Only the sign
 * moves into parentheses: the figure itself is the server's.
 */
export function cdaMoney(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim() === "") return "—";
  const text = value.trim();
  return text.startsWith("-") ? `(${formatCurrency(text.slice(1))})` : formatCurrency(text);
}

/** A server percent ("12.50") with its sign; a missing one reads as a dash. */
export function cdaPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || String(value).trim() === "") return "—";
  return `${String(value).trim()}%`;
}

/** A server figure shown exactly as sent (a PESOS score, weight or ratio); a missing one reads as a dash. */
export function asSent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || String(value).trim() === "") return "—";
  return String(value);
}

/** A whole-number count from the server, with thousands separators. */
export function cdaCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : formatCount(value);
}
