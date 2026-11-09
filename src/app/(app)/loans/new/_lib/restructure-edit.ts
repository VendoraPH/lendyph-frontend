// The loan form's rules where the server's differ by loan: a restructure (one
// sent back for approval is edited here before it is submitted again) has no
// product minimum, no build-up range and its own remarks. Each rule copies the
// server's (`UpdateLoanRequest`, `LoanService::updateLoan()`), so the form
// never blocks what the server accepts. Dependency-free, so it runs under
// `tsx --test`.

import { formatCurrency } from "@/lib/format";
import type { LoanProduct } from "@/types/loan";

/** What a typed amount keeps: digits and one decimal point, at most two decimals. */
export function amountInputValue(raw: string): string {
  const kept = raw.replace(/[^\d.]/g, "");
  const dot = kept.indexOf(".");
  if (dot === -1) return kept;
  const whole = kept.slice(0, dot);
  const fraction = kept.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  return `${whole}.${fraction}`;
}

function centavos(amount: number): number {
  return Math.round(amount * 100);
}

type PrincipalRange = Pick<LoanProduct, "min_amount" | "max_amount">;

/**
 * Why the principal can't be saved under the product's range, or null. A
 * restructure is exempt from the minimum, and the server checks its range only
 * when the principal moves.
 */
export function principalRangeError(
  principal: number,
  product: PrincipalRange | null | undefined,
  loan: { isRestructure: boolean; storedPrincipal: number | null },
): string | null {
  if (!product) return null;
  if (loan.isRestructure && loan.storedPrincipal !== null && centavos(principal) === centavos(loan.storedPrincipal)) {
    return null;
  }
  if (!loan.isRestructure && principal < product.min_amount) {
    return `Minimum amount is ${formatCurrency(product.min_amount)}`;
  }
  if (principal > product.max_amount) return `Maximum amount is ${formatCurrency(product.max_amount)}`;
  return null;
}

type ScbRule = Pick<LoanProduct, "scb_required" | "min_scb" | "max_scb">;

/**
 * Why the build-up can't be saved, or null. The server takes any amount from
 * ₱0.00 for every loan; an ordinary loan is still held to its product's rule
 * here, a restructure only to the server's.
 */
export function scbRuleError(raw: string, product: ScbRule | null | undefined, isRestructure: boolean): string | null {
  const scb = parseFloat(raw) || 0;
  if (scb < 0) return "SCB cannot be negative";
  if (isRestructure) return null;
  if (!raw || scb === 0) return product?.scb_required ? "Share Capital Build-Up amount is required" : null;
  const min = product?.min_scb ?? 0;
  const max = product?.max_scb ?? 0;
  if (min > 0 && scb < min) return `Minimum SCB is ${formatCurrency(min)}`;
  if (max > 0 && scb > max) return `Maximum SCB is ${formatCurrency(max)}`;
  return null;
}

/**
 * What a restructure edit adds to `PUT /loans/{id}`: its build-up as typed,
 * ₱0.00 included, and its remarks, which the server reads only when the
 * principal moves (it keeps the stored ones otherwise).
 */
export function restructureEditFields(input: {
  principal: number;
  storedPrincipal: number | null;
  scb: number;
  remarks: string;
}): { scb_amount: number; remarks?: string } {
  const moved = input.storedPrincipal === null || centavos(input.principal) !== centavos(input.storedPrincipal);
  const remarks = input.remarks.trim();
  return moved && remarks !== "" ? { scb_amount: input.scb, remarks } : { scb_amount: input.scb };
}

/** The server's 422 message on `remarks`, so the form can ask for them; null for any other answer. */
export function remarksRefusal(err: unknown): string | null {
  const response = (err as { response?: { status?: number; data?: { errors?: Record<string, unknown> } } } | null)
    ?.response;
  if (response?.status !== 422) return null;
  const messages = response.data?.errors?.remarks;
  return Array.isArray(messages) && typeof messages[0] === "string" ? messages[0] : null;
}
