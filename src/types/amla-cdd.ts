/**
 * AMLA customer due diligence shapes, as lendyph-backend's `AmlaCddPresenter`
 * sends them (Phase 6, AMLA-B4). Every key has its words beside it; money is
 * a two-decimal string with its ₱ words; dates are YYYY-MM-DD.
 *
 * Profile answers (PEP details, adverse-information notes, change values) are
 * stored encrypted and arrive decrypted for `amla:cdd` holders. They live only
 * in component state for as long as the page is open: never in a store,
 * localStorage or sessionStorage.
 */
import type { AmlaUserRef } from "./amla";

export type AmlaSubjectType = "member" | "walk_in";
/** The route segment for each subject type: `/amla/customers/members/7`. */
export type AmlaSubjectSegment = "members" | "walk-ins";

export type AmlaCddStatus =
  | "not_started"
  | "pending_verification"
  | "verified"
  | "additional_info_required"
  | "edd_required"
  | "review_overdue";

export type AmlaRiskLevel = "low" | "medium" | "high";

export interface AmlaBranchRef {
  id: number;
  name: string;
}

export interface AmlaCddRow {
  type: AmlaSubjectType;
  id: number;
  name: string;
  code: string | null;
  branch: AmlaBranchRef | null;
  is_imported: boolean;
  cdd_status: AmlaCddStatus | string;
  cdd_status_words: string;
  risk_level: AmlaRiskLevel | null;
  risk_level_words: string | null;
  next_review_on: string | null;
  missing_count: number;
}

export interface AmlaCddSubject {
  type: AmlaSubjectType;
  id: number;
  name: string;
  code: string | null;
  branch: AmlaBranchRef | null;
  member_status: string | null;
  is_imported: boolean;
  has_valid_id: boolean;
}

export interface AmlaCddProfile {
  exists: boolean;
  id: number | null;
  nationality: string | null;
  occupation: string | null;
  source_of_funds: string | null;
  source_of_funds_words: string | null;
  source_of_funds_other: string | null;
  purpose: string | null;
  expected_monthly_amount: string | null;
  expected_monthly_amount_words: string | null;
  expected_monthly_count: number | null;
  pep_status: string | null;
  pep_status_words: string | null;
  pep_details: string | null;
  adverse_info: boolean | null;
  adverse_info_note: string | null;
  last_review_on: string | null;
  next_review_on: string | null;
  edd_required: boolean;
  edd_required_since: string | null;
  edd_completed: boolean;
  updated_at: string | null;
}

export interface AmlaCompletenessItem {
  key: string;
  words: string;
}

export interface AmlaCompleteness {
  complete: boolean;
  missing: AmlaCompletenessItem[];
  expired: AmlaCompletenessItem[];
  expiring_soon: AmlaCompletenessItem[];
}

export interface AmlaRiskFactor {
  key: string;
  label: string;
  value: string;
  value_words: string;
  points: number;
}

export interface AmlaRiskAssessment {
  id: number;
  level: AmlaRiskLevel;
  level_words: string;
  computed_level: AmlaRiskLevel;
  computed_level_words: string;
  score: number;
  overridden: boolean;
  override_carried: boolean;
  override_reason: string | null;
  factors: AmlaRiskFactor[];
  trigger: string;
  trigger_words: string;
  rule_version: number | null;
  rules_to_verify: boolean;
  assessed_by: AmlaUserRef | null;
  assessed_at: string;
}

export interface AmlaIdVerification {
  id: number;
  document_id: number | null;
  id_type: string;
  id_type_words: string;
  id_number_masked: string | null;
  method: string;
  method_words: string;
  result: string;
  result_words: string;
  expires_on: string | null;
  notes: string | null;
  verified_by: AmlaUserRef | null;
  verified_at: string;
}

export interface AmlaReview {
  id: number;
  kind: string;
  kind_words: string;
  outcome: string;
  outcome_words: string;
  notes: string | null;
  reviewed_on: string;
  next_review_on: string;
  level_at_review: AmlaRiskLevel | string | null;
  reviewed_by: AmlaUserRef | null;
}

export interface AmlaProfileChange {
  id: number;
  /** Stored field names: shown in words only. */
  fields: string[];
  /** Old and new values: never shown in the history list. */
  changes: unknown;
  changed_by: AmlaUserRef | null;
  changed_at: string;
}

export interface AmlaCddView {
  subject: AmlaCddSubject;
  profile: AmlaCddProfile;
  cdd_status: AmlaCddStatus | string;
  cdd_status_words: string;
  id_state: string;
  id_state_words: string;
  completeness: AmlaCompleteness;
  risk: AmlaRiskAssessment | null;
  id_verifications: AmlaIdVerification[];
  risk_assessments: AmlaRiskAssessment[];
  reviews: AmlaReview[];
  changes: AmlaProfileChange[];
}

/** `PUT /amla/cdd/{type}/{id}`: only the answers that changed. */
export interface AmlaProfileBody {
  nationality?: string | null;
  occupation?: string | null;
  source_of_funds?: string | null;
  source_of_funds_other?: string | null;
  purpose?: string | null;
  expected_monthly_amount?: string | null;
  expected_monthly_count?: number | null;
  pep_status?: string | null;
  pep_details?: string | null;
  adverse_info?: boolean | null;
  adverse_info_note?: string | null;
}

export interface AmlaIdVerificationBody {
  document_id?: number;
  method: string;
  result: string;
  expires_on?: string;
  notes?: string;
}

export interface AmlaRiskAssessmentBody {
  override_level?: AmlaRiskLevel;
  override_reason?: string;
}

export interface AmlaReviewBody {
  kind: string;
  outcome: string;
  notes?: string;
}

/** A member's valid ID as the member documents list sends it; only its type and last four are shown. */
export interface AmlaMemberIdDocument {
  id: number;
  type: string;
  label?: string | null;
  custom_type_name?: string | null;
  id_number?: string | null;
  side?: string | null;
}
