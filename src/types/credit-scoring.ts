export type RiskLevel =
  | "very_low"
  | "low"
  | "moderate"
  | "elevated"
  | "high"
  | "very_high";

export type ScoreConfidence = "high" | "medium" | "low";

export type ScoreType = "application" | "behavioral";

export interface ScoreCategoryBreakdown {
  category: string;
  weight_percent: number;
  points_earned: number;
  points_possible: number;
}

export interface ScoreFactor {
  id: number;
  label: string;
  detail: string;
  impact: "positive" | "risk";
  category: string;
}

export interface CreditScore {
  id: number;
  borrower_id: number;
  borrower_name: string;
  score_type: ScoreType;
  score: number;
  risk_level: RiskLevel;
  confidence: ScoreConfidence;
  model_version: string;
  category_breakdown: ScoreCategoryBreakdown[];
  factors: ScoreFactor[];
  recommendation: string;
  calculated_at: string;
}

export interface CreditScoreHistoryEntry {
  id: number;
  borrower_id: number;
  /**
   * Optional — the backend does not send it yet. Render through
   * `borrowerLabel()` (`src/lib/credit-scoring/borrower-label.ts`), which falls
   * back to `Borrower #{borrower_id}` so the column never goes blank.
   */
  borrower_name?: string;
  score: number;
  risk_level: RiskLevel;
  score_type: ScoreType;
  model_version: string;
  calculated_at: string;
  reason: string;
}

export interface PolicyFlag {
  id: number;
  type: "hard_flag" | "soft_flag";
  label: string;
  detail: string;
  triggered_at: string;
}

export interface CreditDecision {
  id: number;
  borrower_id: number;
  credit_score_id: number;
  decision: "approve" | "decline" | "refer" | "hold";
  reason: string;
  remarks: string | null;
  decided_by: string;
  decided_at: string;
}

export interface ScorecardCategoryConfig {
  key: string;
  label: string;
  weight_percent: number;
  description: string;
}

export interface ScorecardFactorRule {
  id: number;
  category_key: string;
  label: string;
  points: number;
  is_active: boolean;
}

export interface RiskMonitoringSummary {
  total_borrowers: number;
  high_risk_count: number;
  score_declines_30d: number;
  new_hard_flags_30d: number;
}

export interface CreditScoringDashboardSummary {
  total_scored_borrowers: number;
  average_score: number;
  risk_distribution: { risk_level: RiskLevel; count: number }[];
  recent_score_changes: CreditScoreHistoryEntry[];
}

export interface BorrowerScoreRow {
  borrower_id: number;
  borrower_name: string;
  branch_id: number;
  branch_name: string;
  score: number;
  risk_level: RiskLevel;
  score_trend: "up" | "down" | "flat";
  has_active_loan: boolean;
  past_due: boolean;
  calculated_at: string;
}

export interface BorrowerScoreFilters {
  branch_id?: number;
  risk_level?: RiskLevel;
  min_score?: number;
  max_score?: number;
  borrower_type?: string;
  loan_product_id?: number;
  has_active_loan?: boolean;
  past_due?: boolean;
}

export interface ScoreHistoryFilters {
  borrower_id?: number;
  branch_id?: number;
  from?: string;
  to?: string;
}

export interface PolicyRule {
  id: number;
  label: string;
  description: string;
  is_active: boolean;
}

export interface ScorecardConfig {
  categories: ScorecardCategoryConfig[];
  factor_rules: ScorecardFactorRule[];
  policy_rules: PolicyRule[];
}

export interface RiskAlert {
  id: number;
  borrower_id: number;
  borrower_name: string;
  message: string;
  previous_score: number;
  current_score: number;
  severity: "info" | "warning" | "critical";
  created_at: string;
}

export interface RiskMonitoringData {
  summary: RiskMonitoringSummary;
  affected_borrowers: BorrowerScoreRow[];
  alerts: RiskAlert[];
}

export interface CreateCreditDecisionData {
  borrower_id: number;
  credit_score_id: number;
  decision: CreditDecision["decision"];
  reason: string;
  remarks?: string;
}

export interface CreditScoringSettings {
  privacy_notice: string;
  score_model_version: string;
  confidence_definitions: { level: ScoreConfidence; label: string; description: string }[];
  hard_flag_definitions: { type: PolicyFlag["type"]; label: string; description: string }[];
}
