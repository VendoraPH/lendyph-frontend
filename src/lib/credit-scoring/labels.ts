import type {
  CapacityAssessment,
  CreditDecisionValue,
  FactorRule,
  IncomeVerification,
  MemberType,
  RiskAlert,
  RiskAlertKind,
  ScoreContext,
  ScoreStatus,
  ScoreTrend,
  ScoreType,
} from "@/types/credit-scoring";

/**
 * Words for the keys the Credit Scoring API sends without labels. Labels the
 * server does send (factor, flag, band and category labels, recommendations,
 * reasons) are shown as sent and never mapped here.
 */
export const SCORE_STATUS_LABELS: Record<ScoreStatus, string> = {
  scored: "Scored",
  insufficient_data: "Insufficient data",
  not_scored: "Not scored yet",
};

export const SCORE_CONTEXT_LABELS: Record<ScoreContext, string> = {
  nightly: "Nightly score",
  assessment: "Loan assessment",
};

export const SCORE_TYPE_LABELS: Record<ScoreType, string> = {
  application: "Application score",
  behavioral: "Behavioral score",
};

export const ALERT_KIND_LABELS: Record<RiskAlertKind, string> = {
  score_decline: "Score decline",
  high_risk: "High risk",
};

export const ALERT_SEVERITY_LABELS: Record<RiskAlert["severity"], string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
};

export const CAPACITY_ASSESSMENT_LABELS: Record<CapacityAssessment, string> = {
  manageable: "Manageable",
  caution: "Caution",
  above_capacity: "Above capacity",
};

export const INCOME_VERIFICATION_LABELS: Record<IncomeVerification, string> = {
  verified: "Verified",
  failed: "Could not be verified",
};

export const DECISION_LABELS: Record<CreditDecisionValue, string> = {
  approve: "Approve",
  decline: "Decline",
  refer: "Refer",
  hold: "Hold",
};

export const SCORE_TREND_LABELS: Record<ScoreTrend, string> = {
  up: "Score went up",
  down: "Score went down",
  flat: "No change",
};

export const MEMBER_TYPE_LABELS: Record<MemberType, string> = {
  regular: "Regular",
  associate: "Associate",
};

/** A factor rule as it reads before a threshold ("at least 95%"). */
export const FACTOR_RULE_LABELS: Record<FactorRule, string> = {
  at_least: "at least",
  at_most: "at most",
};

/** A key's words, or a dash when the server sent none. */
export function labelOf<K extends string>(labels: Record<K, string>, key: K | null | undefined): string {
  return key ? (labels[key] ?? "—") : "—";
}
