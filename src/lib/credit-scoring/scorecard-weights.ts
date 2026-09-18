import type { ScorecardCategoryConfig } from "@/types/credit-scoring";

export function sumWeights(categories: ScorecardCategoryConfig[]): number {
  // Number() is load-bearing, not defensive noise. Laravel serialises a
  // `decimal:2` column as a JSON *string*, so `0 + "25"` concatenates: the
  // six real categories yield "0252015151510", isValidWeightTotal() returns
  // false, and the Save button is disabled forever with no error shown.
  return categories.reduce((total, c) => total + Number(c.weight_percent), 0);
}

/**
 * Whether the category weights add up to exactly 100%.
 * Rounds to two decimal places before comparing — the inputs are percentages
 * a human typed, and floating-point addition of values like 16.67 would
 * otherwise reject a total that is visibly 100 on screen.
 */
export function isValidWeightTotal(categories: ScorecardCategoryConfig[]): boolean {
  if (categories.length === 0) return false;
  return Math.round(sumWeights(categories) * 100) / 100 === 100;
}
