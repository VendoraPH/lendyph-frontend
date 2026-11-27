import { parseMoneyInput } from "@/lib/money-input";
import type { SavingsProduct, SavingsRateInput, SavingsTierRateInput } from "@/types";
import { rateProblem } from "./product-draft";

export { ladderLines, tierLabel } from "@/lib/savings/rate-ladder";

/** The most tiers one ladder holds, the base tier included (the server's limit). */
export const MAX_TIERS = 20;

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

/** A regular product's ladder as typed: the base rate, then "₱X and up" rows. */
export interface TierDraft {
  baseRate: string;
  tiers: Array<{ minBalance: string; rate: string }>;
  effectiveFrom: string;
}

/**
 * `POST /savings/products/{id}/rates` with `tiers`, base tier first, or the
 * labels to fix. Rows left wholly blank are dropped. Minimums go as typed
 * (two-decimal text) in the order typed; the server checks they rise and
 * answers in words, so nothing is compared or sorted here. Rates are never
 * rounded.
 */
export function readTierDraft(d: TierDraft, today: string): { input: SavingsTierRateInput; problems: string[] } {
  const problems: string[] = [];
  const baseError = rateProblem(d.baseRate, "Base rate");
  if (baseError) problems.push(baseError);
  const rows = d.tiers.filter((t) => t.minBalance.trim() !== "" || t.rate.trim() !== "");
  if (rows.length + 1 > MAX_TIERS) problems.push(`At most ${MAX_TIERS} tiers, the base rate included`);
  const tiers: SavingsTierRateInput["tiers"] = [{ min_balance: null, annual_rate: d.baseRate.trim() }];
  rows.forEach((t, i) => {
    const min = parseMoneyInput(t.minBalance, { label: "Minimum balance" });
    if (!min.ok) problems.push(`Tier ${i + 1}: minimum balance above ₱0.00`);
    const rateError = rateProblem(t.rate, `Tier ${i + 1}: annual rate`);
    if (rateError) problems.push(rateError);
    tiers.push({ min_balance: min.ok ? min.value : null, annual_rate: t.rate.trim() });
  });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.effectiveFrom) || d.effectiveFrom < today) {
    problems.push("Effective from (today or later)");
  }
  return { input: { tiers, effective_from: d.effectiveFrom }, problems };
}
