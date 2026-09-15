import type { ScoreConfidence } from "@/types/credit-scoring";

const CONFIDENCE_LABELS: Record<ScoreConfidence, string> = {
  high: "High Confidence",
  medium: "Medium Confidence",
  low: "Low Confidence",
};

const CONFIDENCE_COLORS: Record<ScoreConfidence, string> = {
  high: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-800",
  medium: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800",
  low: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
};

export function confidenceLabel(level: ScoreConfidence): string {
  return CONFIDENCE_LABELS[level];
}

export function confidenceColor(level: ScoreConfidence): string {
  return CONFIDENCE_COLORS[level];
}
