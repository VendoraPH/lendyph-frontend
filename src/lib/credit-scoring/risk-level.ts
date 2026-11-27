import type { BranchRiskRow, CreditScoringDashboardSummary, RiskLevel } from "@/types/credit-scoring";
import { RISK_LEVEL_COLORS, RISK_LEVEL_LABELS } from "@/constants/risk-level";
import { countOrDash } from "./score-state";

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

/** The six levels, very low to very high: the branch table's columns. */
export const RISK_LEVELS = Object.keys(RISK_LEVEL_LABELS) as RiskLevel[];

/** A branch row's count for each level, in order; a level the server didn't send reads a dash. */
export function branchRiskCells(row: BranchRiskRow): RiskLegendItem[] {
  return RISK_LEVELS.map((level) => ({
    level,
    label: RISK_LEVEL_LABELS[level],
    count: countOrDash(row.risk_distribution.find((d) => d.risk_level === level)?.count),
  }));
}

/** The row's branch, or "No branch" for members without one. */
export function branchRiskName(row: Pick<BranchRiskRow, "branch_name">): string {
  return row.branch_name ?? "No branch";
}
