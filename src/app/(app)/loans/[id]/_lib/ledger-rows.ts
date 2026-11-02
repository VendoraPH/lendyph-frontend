/**
 * Ledger row figures, picked from the server's records; nothing is added up.
 * Pure, so it runs under `tsx --test`.
 */
import { repaymentInsuranceApplied } from "@/lib/insurance-premium";
import { toNumber } from "@/lib/report-format";

/**
 * An extension's "pay" credit entry stands in for the repayment it is linked
 * to (shown once, under the entry's description). That repayment may also
 * have collected insurance premium owed, so the row's Total Paid is the
 * repayment's `amount_paid` and its premium the repayment's
 * `insurance_applied`. Without a readable repayment the entry's own amount
 * stands, with no premium.
 */
export function creditEntryPaid(
  entryAmount: number,
  linked: { amount_paid?: unknown; insurance_applied?: unknown } | null,
): { totalPaid: number; insuranceApplied: number | null } {
  const amountPaid = typeof linked?.amount_paid === "number" || typeof linked?.amount_paid === "string"
    ? toNumber(linked.amount_paid)
    : null;
  if (linked === null || amountPaid === null) return { totalPaid: entryAmount, insuranceApplied: null };
  return { totalPaid: amountPaid, insuranceApplied: repaymentInsuranceApplied(linked) };
}
