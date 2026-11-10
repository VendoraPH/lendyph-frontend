import type { SavingsProduct, SavingsRateInput } from "@/types";
import { rateProblem } from "./product-draft";

export interface RateDraft {
  /** "" on a regular product; one of the product's terms on a time deposit. */
  termDays: string;
  rate: string;
  effectiveFrom: string;
}

/**
 * `POST /savings/products/{id}/rates`, or the labels to fix. Rates are
 * append-only: a new row takes effect on `effective_from` (today or later)
 * and the old one stays in the history.
 */
export function readRateDraft(
  d: RateDraft,
  product: Pick<SavingsProduct, "kind" | "term_options_days">,
  today: string,
): { input: SavingsRateInput; problems: string[] } {
  const problems: string[] = [];
  const td = product.kind === "time_deposit";
  const term = Number(d.termDays);
  if (td && !(product.term_options_days ?? []).includes(term)) problems.push("Term");
  const rateError = rateProblem(d.rate, "Annual rate");
  if (rateError) problems.push(rateError);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.effectiveFrom) || d.effectiveFrom < today) {
    problems.push("Effective from (today or later)");
  }
  return {
    input: {
      annual_rate: d.rate.trim(),
      term_days: td ? term : null,
      effective_from: d.effectiveFrom,
    },
    problems,
  };
}

/** "Regular" or "90 days" for a rate row's term. */
export function rateTermLabel(termDays: number | null): string {
  if (termDays === null) return "All balances";
  return `${termDays} day${termDays === 1 ? "" : "s"}`;
}
