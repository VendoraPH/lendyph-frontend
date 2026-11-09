import type { CreditScoringDashboardSummary, RiskLevel } from "@/types/credit-scoring";
import { RISK_LEVEL_COLORS, RISK_LEVEL_LABELS } from "@/constants/risk-level";

export function riskLevelLabel(level: RiskLevel): string {
  return RISK_LEVEL_LABELS[level];
}

export function riskLevelColor(level: RiskLevel): string {
  return RISK_LEVEL_COLORS[level];
}

export interface RiskLegendItem {
  level: RiskLevel;
  label: string;
  count: string;
}

/** The donut's legend: each band the server sent, its name and its count, in the server's order. */
export function riskLegend(distribution: CreditScoringDashboardSummary["risk_distribution"]): RiskLegendItem[] {
  return distribution.map((d) => ({ level: d.risk_level, label: RISK_LEVEL_LABELS[d.risk_level], count: String(d.count) }));
}
