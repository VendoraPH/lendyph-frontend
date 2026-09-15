import type { RiskLevel } from "@/types/credit-scoring";

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  very_low: "Very Low Risk",
  low: "Low Risk",
  moderate: "Moderate Risk",
  elevated: "Elevated Risk",
  high: "High Risk",
  very_high: "Very High Risk",
};

export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  very_low: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-800",
  low: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800",
  moderate: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800",
  elevated: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-800",
  high: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  very_high: "bg-red-200 text-red-800 border-red-300 dark:bg-red-500/25 dark:text-red-300 dark:border-red-700",
};
