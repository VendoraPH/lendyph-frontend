import type { RiskLevel } from "@/types/credit-scoring";
import { RISK_LEVEL_COLORS, RISK_LEVEL_LABELS } from "@/constants/risk-level";

export function riskLevelLabel(level: RiskLevel): string {
  return RISK_LEVEL_LABELS[level];
}

export function riskLevelColor(level: RiskLevel): string {
  return RISK_LEVEL_COLORS[level];
}
