import type { ScorecardCategoryConfig } from "@/types/credit-scoring";

export function sumWeights(categories: ScorecardCategoryConfig[]): number {
  return categories.reduce((total, c) => total + c.weight_percent, 0);
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
