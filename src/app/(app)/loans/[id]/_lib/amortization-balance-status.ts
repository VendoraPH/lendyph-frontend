import type { AmortizationBalancePeriod } from "@/types/loan";

export type BalanceStatus = "paid" | "overdue" | "partial" | "upcoming";

/**
 * The Amortization Balance tab's status for one period, from the server's
 * answer alone.
 *
 * Late is the server's `is_late` (unpaid past the grace period, the test
 * behind the summary's Overdue figure), never a comparison with today's date
 * here, which ignored the grace period. It outranks partial: a part-paid
 * period past its grace is still overdue.
 */
export function balanceStatus(period: Pick<AmortizationBalancePeriod, "status" | "is_late">): BalanceStatus {
  if (period.status === "paid") return "paid";
  if (period.is_late) return "overdue";
  if (period.status === "partial") return "partial";
  return "upcoming";
}
