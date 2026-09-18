import type { RiskLevel } from "@/types/credit-scoring";
import { RISK_LEVEL_COLORS, RISK_LEVEL_LABELS } from "@/constants/risk-level";

export function riskLevelLabel(level: RiskLevel): string {
  return RISK_LEVEL_LABELS[level];
}

export function riskLevelColor(level: RiskLevel): string {
  return RISK_LEVEL_COLORS[level];
}

export interface RiskLevelThreshold {
  level: RiskLevel;
  min: number;
}

/**
 * Client-side display only — for the Scorecard Configuration form's live
 * preview as an admin edits thresholds. The backend is the source of truth
 * for a borrower's actual `risk_level` and returns it directly; this never
 * recomputes one for a real score.
 */
export function riskLevelFromScore(score: number, thresholds: RiskLevelThreshold[]): RiskLevel {
  const sorted = [...thresholds].sort((a, b) => b.min - a.min);
  const match = sorted.find((t) => score >= t.min);
  return match ? match.level : sorted[sorted.length - 1].level;
}
