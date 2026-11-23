import { formatCurrency } from "@/lib/format";
import type { PublicEstimate } from "@/types/public-application";
import { scheduleWords } from "./portal-state";

/** The period a payment reads per, where it's a plain one. */
const PER: Record<string, string> = { daily: "a day", weekly: "a week", monthly: "a month" };

/**
 * The estimate's headline. The server's `installment` is its highest payment
 * (`PublicEstimate::estimate()`), so it reads as an upper bound: "Up to
 * ₱9,833.35 a month · 6 monthly payments". No "regular" payment is worked out
 * here; a single payment is just that payment.
 */
export function estimateHeadline(estimate: Pick<PublicEstimate, "installment" | "installments_count" | "frequency">): string {
  const amount = formatCurrency(estimate.installment);
  if (estimate.installments_count === 1) return `${amount} in one payment`;
  const per = PER[estimate.frequency] ?? "a payment";
  return `Up to ${amount} ${per} · ${estimate.installments_count} ${scheduleWords(estimate.frequency).toLowerCase()} payments`;
}
