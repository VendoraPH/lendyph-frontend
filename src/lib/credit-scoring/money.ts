import { formatCurrency } from "@/lib/format";

/** Why a loan figure reads a dash: the server withholds it without loans:view. */
export const LOANS_VIEW_REASON = "Shown only to staff who can view loans.";

/** A server ₱ string with two decimals, or a dash when the server sent none. */
export function pesosOrDash(amount: string | null | undefined): string {
  return amount === null || amount === undefined ? "—" : formatCurrency(amount);
}

/**
 * The reason a withheld loan figure reads a dash: the server sends null to a
 * caller without loans:view. A sent figure (₱0.00 and 0 included) has none.
 */
export function loanFigureReason(value: string | number | null | undefined): string | null {
  return value === null ? LOANS_VIEW_REASON : null;
}
