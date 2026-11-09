/**
 * The Credit Scoring API's shapes (backend PR #240, slice C2s).
 *
 * Every answer is `{ success, data }`, unwrapped by `api.get`. The three lists
 * answer a flat Laravel paginator in `data` (see `CreditScoringPage`). Money
 * comes as two-decimal peso strings, and the browser only displays it.
 */

export type RiskLevel =
  | "very_low"
  | "low"
  | "moderate"
  | "elevated"
  | "high"
  | "very_high";

export type ScoreConfidence = "high" | "medium" | "low";

export type ScoreType = "application" | "behavioral";

/** `not_scored` is only ever sent for a member's profile before the first score. */
export type ScoreStatus = "scored" | "insufficient_data" | "not_scored";

export type ScoreContext = "nightly" | "assessment";

export type CapacityAssessment = "manageable" | "caution" | "above_capacity";

export type IncomeVerification = "verified" | "failed";

export type RiskAlertKind = "score_decline" | "high_risk";

export type EmploymentStatus =
  | "employed"
  | "self_employed"
  | "business_owner"
  | "overseas_worker"
  | "retired"
  | "not_employed"
  | "other";

/** A decimal column as the server sends it: a number or a decimal string. */
export type DecimalValue = number | string;

/**
 * One page of a list. Laravel's paginator sits flat inside `data`, so there is
 * no `meta` and the app's `PaginatedResponse` doesn't fit.
 */
export interface CreditScoringPage<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PageParams {
  page?: number;
  per_page?: number;
}

export interface ScoreCategoryBreakdown {
  key: string;
  category: string;
  weight_percent: DecimalValue;
  points_earned: number;
  points_possible: number;
  has_data: boolean;
}

export interface ScoreFactor {
  id: number;
  label: string;
  detail: string;
  impact: "positive" | "risk";
  category: string;
}

export interface FactorWithoutData {
  label: string;
  category: string;
}

/**
 * The stored capacity block. Money is two-decimal peso strings; every figure
 * but `existing_debt_payments` is null when the server lacks what it needs, and
 * the whole block is null for a viewer who may not see it.
 */
export interface CreditCapacity {
  monthly_income: string | null;
  household_expenses: string | null;
  existing_debt_payments: string | null;
  proposed_payment: string | null;
  proposed_payment_basis: string | null;
  disposable_income: string | null;
  suggested_maximum_payment: string | null;
  /** A percent string with two decimals ("25.00"). */
  debt_service_ratio: string | null;
  assessment: CapacityAssessment | null;
  proposed_fits: boolean | null;
}

/**
 * The engine's inputs. `loan_ids` and `branch_ids` keep only what the caller
 * can see; `other_branch_loans` counts the loans left out.
 */
export interface CreditDataUsed {
  loan_ids: number[];
  branch_ids: number[];
  other_branch_loans: number;
  [key: string]: unknown;
}

export interface CreditScore {
  /** Null with `not_scored`. */
  id: number | null;
  borrower_id: number;
  borrower_name: string;
  borrower_code: string | null;
  score_type: ScoreType | null;
  /** Null with `insufficient_data` and `not_scored`. */
  score: number | null;
  risk_level: RiskLevel | null;
  /** Absent with `details_hidden`. */
  confidence?: ScoreConfidence | null;
  model_version: string | null;
  /** Empty with `details_hidden`. */
  category_breakdown?: ScoreCategoryBreakdown[];
  /** Empty with `details_hidden`. */
  factors?: ScoreFactor[];
  /** One generic sentence with `details_hidden`. */
  recommendation: string;
  calculated_at: string | null;
  status: ScoreStatus;
  limited_history: boolean;
  /** Absent with `details_hidden`. */
  confidence_reason?: string | null;
  validated: boolean | null;
  previous_score: number | null;
  context: ScoreContext | null;
  loan_id: number | null;
  /** Empty with `details_hidden`. */
  factors_without_data?: FactorWithoutData[];
  /**
   * True when the caller may not see the member's financial figures: then
   * `capacity` (and `data_used.capacity`) is null and the factor lines that
   * would print income or debt read generic text.
   */
  financials_hidden: boolean;
  /**
   * True for a caller who can't read the member's details (no borrowers:view
   * or not the member's branch): the summary only. Absent on an older API.
   */
  details_hidden?: boolean;
  /** Absent with `details_hidden`. */
  capacity?: CreditCapacity | null;
  /** Absent with `details_hidden`. */
  data_used?: CreditDataUsed | null;
}

export interface CreditScoreHistoryEntry {
  id: number;
  borrower_id: number;
  borrower_name: string | null;
  borrower_code: string | null;
  score: number | null;
  risk_level: RiskLevel | null;
  score_type: ScoreType;
  model_version: string;
  calculated_at: string;
  /** "Recalculated" for a summary caller; tolerated when absent. */
  reason?: string;
  status: Exclude<ScoreStatus, "not_scored">;
  previous_score: number | null;
}

/** `GET /borrowers/{id}/policy-flags`: empty with `details_hidden`. */
export interface PolicyFlagList {
  data: PolicyFlag[];
  details_hidden: boolean;
}

export interface PolicyFlag {
  id: number;
  type: "hard_flag" | "soft_flag";
  label: string;
  detail: string;
  triggered_at: string;
  loan_id: number | null;
}

/** A member's decisions, newest first. A summary caller's leave out reason and remarks. */
export interface CreditDecisionPage extends CreditScoringPage<CreditDecision> {
  details_hidden: boolean;
}

export type CreditDecisionValue = "approve" | "decline" | "refer" | "hold";

export interface CreditDecision {
  id: number;
  borrower_id: number;
  loan_id: number | null;
  /**
   * The loan's account number when the decision names a loan the caller can
   * see; null for a member-level decision. Absent on an API that predates it.
   */
  loan_account_number?: string | null;
  credit_score_id: number;
  decision: CreditDecisionValue;
  /** Absent for a summary caller (`details_hidden`). */
  reason?: string;
  /** Absent for a summary caller (`details_hidden`). */
  remarks?: string | null;
  decided_by: string;
  decided_at: string;
  revision_version: string | null;
}

export interface ScorecardCategoryConfig {
  key: string;
  label: string;
  weight_percent: DecimalValue;
  description: string;
}

export interface ScorecardFactorRule {
  id: number;
  category_key: string;
  label: string;
  points: number;
  is_active: boolean;
}

export interface PolicyRule {
  id: number;
  label: string;
  description: string;
  is_active: boolean;
}

export interface RiskBand {
  key: RiskLevel;
  label: string;
  min_score: number;
}

export interface ScorecardConfig {
  version: string;
  validated: boolean;
  categories: ScorecardCategoryConfig[];
  factor_rules: ScorecardFactorRule[];
  policy_rules: PolicyRule[];
  risk_bands: RiskBand[];
}

/**
 * The scorecard PUT body. Weights and band minimums go as typed; the rules go
 * back exactly as the server sent them.
 */
export interface UpdateScorecardConfigData {
  categories: { key: string; weight_percent: DecimalValue }[];
  factor_rules: ScorecardFactorRule[];
  policy_rules: PolicyRule[];
  risk_bands: { key: RiskLevel; min_score: number | string }[];
}

export interface RiskMonitoringSummary {
  total_borrowers: number;
  high_risk_count: number;
  score_declines_30d: number;
  /** Null for a caller without borrowers:view. */
  new_hard_flags_30d?: number | null;
}

export interface CreditScoringDashboardSummary {
  total_scored_borrowers: number;
  /** Null when no one is scored. */
  average_score: number | null;
  insufficient_data_count: number;
  risk_distribution: { risk_level: RiskLevel; count: number }[];
  recent_score_changes: CreditScoreHistoryEntry[];
}

export interface BorrowerScoreRow {
  borrower_id: number;
  borrower_name: string | null;
  borrower_code: string | null;
  branch_id: number | null;
  branch_name: string | null;
  score: number | null;
  risk_level: RiskLevel | null;
  score_trend: "up" | "down" | "flat" | null;
  /** Null without loans:view. */
  has_active_loan: boolean | null;
  /** Null without loans:view. */
  past_due: boolean | null;
  calculated_at: string | null;
  status: Exclude<ScoreStatus, "not_scored">;
}

export interface BorrowerScoreFilters {
  /** A name or member code, matched on the server (at most 100 characters). */
  search?: string;
  branch_id?: number;
  risk_level?: RiskLevel;
  min_score?: number;
  max_score?: number;
  /** Needs loans:view (422 without it). */
  has_active_loan?: boolean;
  /** Needs loans:view (422 without it). */
  past_due?: boolean;
}

export interface ScoreHistoryFilters {
  borrower_id?: number;
  branch_id?: number;
  /** Inclusive Manila dates, `YYYY-MM-DD`. */
  from?: string;
  to?: string;
}

export interface RiskAlert {
  id: number;
  borrower_id: number;
  borrower_name: string | null;
  borrower_code: string | null;
  message: string;
  /** Null for a first score. */
  previous_score: number | null;
  current_score: number | null;
  severity: "info" | "warning" | "critical";
  kind: RiskAlertKind;
  created_at: string;
}

export interface RiskMonitoringData {
  summary: RiskMonitoringSummary;
  /** At most 100 rows; `affected_total` is the full count. */
  affected_borrowers: BorrowerScoreRow[];
  affected_total: number;
  alerts: RiskAlert[];
}

export interface CreateCreditDecisionData {
  borrower_id: number;
  credit_score_id: number;
  decision: CreditDecisionValue;
  reason: string;
  remarks?: string;
  /** Required by the server for a decision on a loan assessment's score. */
  loan_id?: number;
}

export interface CreditScoringPolicyFigures {
  dsr_manageable_max: DecimalValue;
  dsr_caution_max: DecimalValue;
  capacity_share: DecimalValue;
  max_active_loans: number;
  hard_past_due_days: number;
  decline_alert_points: number;
}

export interface CreditScoringSettings extends CreditScoringPolicyFigures {
  privacy_notice: string;
  /** Read only: a PUT carrying it answers 422. */
  score_model_version: string;
  notice_version: number | string | null;
  confidence_definitions: { level: ScoreConfidence; label: string; description: string }[];
  hard_flag_definitions: { type: PolicyFlag["type"]; label: string; description: string }[];
}

/** The settings PUT body: the notice and the six figures, as typed. */
export type UpdateCreditScoringSettingsData = Partial<{
  privacy_notice: string;
  dsr_manageable_max: string;
  dsr_caution_max: string;
  capacity_share: string;
  max_active_loans: string;
  hard_past_due_days: string;
  decline_alert_points: string;
}>;

/**
 * A loan application's own details. Money is two-decimal peso strings. With
 * `details_hidden` only the three notice fields are sent; every other key is
 * absent.
 */
export interface CreditApplicationProfile {
  other_income?: string | null;
  business_income?: string | null;
  household_expenses?: string | null;
  outside_debt_payments?: string | null;
  outside_lenders_count?: number | null;
  employment_status?: EmploymentStatus | null;
  business_start_date?: string | null;
  years_at_residence?: DecimalValue | null;
  verified_references_count?: number | null;
  income_verification?: IncomeVerification | null;
  notice_version: number | string | null;
  notice_acknowledged_at: string | null;
  /** True when acknowledged under the current notice version. */
  notice_acknowledged: boolean;
}

export interface LoanCreditAssessment {
  loan_id: number;
  loan_status: string;
  /** Draft or for approval. */
  editable: boolean;
  borrower_id: number;
  borrower_name: string;
  borrower_code: string | null;
  notice_version: number | string | null;
  privacy_notice: string;
  /** Null before any details are saved. */
  application_profile: CreditApplicationProfile | null;
  /**
   * True when the application details are hidden from the caller (they need
   * borrowers:view and the member's branch): every `application_profile`
   * field but the notice fields then arrives as null or absent.
   */
  application_figures_hidden?: boolean;
  /** The summary-only view; true together with `application_figures_hidden`. */
  details_hidden?: boolean;
  /** The loan's latest assessment, or null. A summary with `details_hidden`. */
  score: CreditScore | null;
  /**
   * Null without the score, or when the caller may not see the financials;
   * absent with `details_hidden`.
   */
  capacity?: CreditCapacity | null;
  /** Empty with `details_hidden`. */
  policy_flags?: PolicyFlag[];
  /** This loan's latest 50 decisions, newest first. */
  decisions: CreditDecision[];
  decisions_total: number;
  /** The employment statuses the PUT accepts, with their labels. */
  employment_statuses: { value: EmploymentStatus; label: string }[];
}

/**
 * The assessment PUT body. A field left out is unchanged and null clears it;
 * figures go as typed.
 */
export interface SaveLoanAssessmentData {
  other_income?: string | null;
  business_income?: string | null;
  household_expenses?: string | null;
  outside_debt_payments?: string | null;
  outside_lenders_count?: string | null;
  employment_status?: string | null;
  business_start_date?: string | null;
  years_at_residence?: string | null;
  verified_references_count?: string | null;
  income_verification?: IncomeVerification | null;
  notice_acknowledged?: boolean;
}
