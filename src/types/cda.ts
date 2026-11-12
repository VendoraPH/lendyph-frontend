/**
 * CDA Compliance (CDA design §3), as the backend sends it.
 *
 * - Money and percents are two-decimal strings ("1500.50", "-12.05"); the
 *   browser shows them as sent and never works one out.
 * - Dates are YYYY-MM-DD; timestamps are UTC ISO strings.
 * - Deadlines (`effective_deadline`, `days_remaining`), readiness and issues
 *   are the server's.
 * - Files are signed links (`url`, valid 30 minutes), never built here.
 */

/** A user as the CDA endpoints name one; null for the system. */
export interface CdaUserRef {
  id: number;
  name: string;
}

export type CdaReportType =
  | "capr"
  | "financial_statements"
  | "performance_audit"
  | "social_audit"
  | "pesos"
  | "officers_trainings"
  | "mediation"
  | "sworn_statement"
  | "atir"
  | "abr";

/** Mediation has one report per half; every other type one annual report. */
export type CdaReportPart = "annual" | "h1" | "h2";

export type CdaReportStatus =
  | "draft"
  | "for_review"
  | "approved"
  | "finalized"
  | "submitted"
  | "accepted"
  | "for_correction";

/** What the dashboard and calendar show: the status, or one of the display-only words. */
export type CdaDisplayStatus =
  | CdaReportStatus
  | "not_applicable"
  | "not_started"
  | "returned"
  | "validation_failed";

export type CdaWorkflowAction =
  | "refresh"
  | "submit_for_review"
  | "return"
  | "approve"
  | "finalize"
  | "mark_submitted"
  | "mark_accepted"
  | "mark_for_correction"
  | "reopen"
  | "set_stage";

export type CdaSeverity = "critical" | "warning" | "info";

export type CdaIssueCategory =
  | "missing_required_data"
  | "invalid_data"
  | "accounting_mismatch"
  | "member_data"
  | "loan_data"
  | "officer_data"
  | "training"
  | "compliance_document"
  | "financial_data"
  /** The template, or the PESOS rules, still to be checked against CDA's own form. */
  | "template_unverified";

export type CdaIssueComponent = "fields" | "sources" | "documents" | "accounting" | "approvals";

export interface CdaIssue {
  id: string;
  rule_id: string | null;
  severity: CdaSeverity;
  category: CdaIssueCategory | string;
  component: CdaIssueComponent | string;
  message: string;
  section_key: string | null;
  field_key: string | null;
  fix_href: string | null;
  stage: string | null;
  /** On the dashboard's cross-report list only. */
  report_id?: number;
  report_type?: CdaReportType;
  part?: CdaReportPart;
}

export interface CdaTemplateRef {
  id: number;
  name: string;
  version: string;
  verified: boolean;
}

/** A report as a list or calendar row (`CdaPresenter::reportRow`). */
export interface CdaReportRow {
  id: number;
  period_id: number;
  year: number;
  report_type: CdaReportType;
  part: CdaReportPart;
  title: string;
  title_part: string;
  status: CdaReportStatus;
  sub_status: "returned" | null;
  applicable: boolean;
  not_applicable_reason: string | null;
  /** True when the viewer lacks the report's restricted view permission. */
  restricted: boolean;
  template: CdaTemplateRef | null;
  default_due_on: string;
  due_override_on: string | null;
  due_override_reference: string | null;
  effective_deadline: string;
  days_remaining: number;
}

export interface CdaPeriod {
  id: number;
  year: number;
  period_start: string;
  period_end: string;
  default_deadline: string;
  extended_deadline: string | null;
  extension_reference: string | null;
  effective_deadline: string;
  days_remaining: number;
  year_end_captured_at: string | null;
  created_by: CdaUserRef | null;
  created_at: string | null;
  /** `GET /cda/periods` only. */
  report_count?: number;
  /** `GET /cda/periods/{year}` and `POST /cda/periods` only. */
  reports?: CdaReportRow[];
}

/** One row of the dashboard's report list. */
export interface CdaDashboardReport {
  id: number;
  type: CdaReportType;
  report_type: CdaReportType;
  part: CdaReportPart;
  title: string;
  title_part: string;
  status: CdaReportStatus;
  display_status: CdaDisplayStatus;
  sub_status: "returned" | null;
  readiness: number;
  critical: number;
  warnings: number;
  applicable: boolean;
  restricted: boolean;
  effective_deadline: string;
  days_remaining: number;
  updated_at: string | null;
}

export interface CdaDashboard {
  period: CdaPeriod;
  readiness: number;
  readiness_label: string;
  counts: {
    total: number;
    applicable: number;
    by_status: Partial<Record<CdaDisplayStatus, number>>;
    critical: number;
    warnings: number;
    filed: number;
  };
  next_deadline: {
    report_id: number;
    report_type: CdaReportType;
    part: CdaReportPart;
    title: string;
    title_part: string;
    effective_deadline: string;
    days_remaining: number;
  } | null;
  reports: CdaDashboardReport[];
  issues: CdaIssue[];
}

export interface CdaCalendarRow extends CdaReportRow {
  display_status: CdaDisplayStatus;
  readiness: number;
  filed: boolean;
}

export type CdaFieldType =
  | "text"
  | "textarea"
  | "number"
  | "money"
  | "percent"
  | "date"
  | "select"
  | "boolean"
  | "compliance"
  | "table";

export type CdaColumnFormat = "text" | "number" | "money" | "percent" | "date";

/** A stored value: money, percent and decimals as strings, whole numbers as numbers. */
export type CdaFieldValue = string | number | boolean | null;

export interface CdaColumn {
  key: string;
  label: string;
  format?: CdaColumnFormat;
}

export interface CdaEvidence {
  document_id?: number | null;
  label?: string | null;
  note?: string | null;
}

export interface CdaField {
  key: string;
  field_key: string;
  section_key: string;
  label: string;
  type: CdaFieldType;
  value: CdaFieldValue;
  /** Where the figure came from, in words ("Members · as of Dec 31, 2026", "Calculated"). */
  source: string | null;
  source_key: string | null;
  source_value: CdaFieldValue;
  source_error: string | null;
  as_of: string | null;
  provisional: boolean;
  note: string | null;
  calculated: boolean;
  overridden: boolean;
  override_reason: string | null;
  editable: boolean;
  overridable: boolean;
  required: boolean;
  options: { value: string; label: string }[] | null;
  decimals: number | null;
  help: string | null;
  remarks: string | null;
  evidence: CdaEvidence[] | null;
}

export interface CdaFieldsSection {
  kind: "fields";
  key: string;
  title: string;
  description: string | null;
  fields: CdaField[];
}

export interface CdaTableSection {
  kind: "table";
  key: string;
  title: string;
  description: string | null;
  columns: CdaColumn[];
  rows: Record<string, CdaFieldValue>[];
  source: string | null;
  source_key: string | null;
  source_error: string | null;
  provisional: boolean;
  editable: boolean;
  remarks: string | null;
}

export type CdaSection = CdaFieldsSection | CdaTableSection;

export interface CdaReadinessBucket {
  passed: number;
  total: number;
  percent: number;
}

export interface CdaReadinessBreakdown {
  passed: number;
  total: number;
  by_component: Record<string, CdaReadinessBucket>;
  by_section: Record<string, CdaReadinessBucket>;
  failed: string[];
}

export interface CdaSnapshotSummary {
  id: number;
  version: number;
  checksum: string;
  finalized_at: string | null;
  finalized_by: CdaUserRef | null;
  superseded_at: string | null;
  reopened_by: CdaUserRef | null;
  reopen_reason: string | null;
}

/**
 * `GET /cda/reports/{id}/snapshots/{version}`: one finalized version with the
 * frozen report as it was filed. Only the parts the screen shows are typed.
 */
export interface CdaSnapshot extends CdaSnapshotSummary {
  payload: {
    template: { name: string; version: string; verified: boolean } | null;
    readiness: number;
    warnings_confirmed: boolean;
    issues: CdaIssue[];
    values: Record<string, unknown>;
  } | null;
}

/** `POST /cda/reports/{id}/snapshots/{version}/verify`: the server's check of the stored payload. Writes nothing. */
export interface CdaSnapshotCheck {
  version: number;
  checksum: string;
  checksum_matches: boolean;
}

export interface CdaHistoryEvent {
  id: number;
  /** A workflow action key, or `save` / `refresh`. */
  action: string;
  from_status: CdaReportStatus | null;
  to_status: CdaReportStatus | null;
  user: CdaUserRef | null;
  user_name: string;
  reason: string | null;
  description: string | null;
  created_at: string;
}

/** `GET /cda/reports/{id}` (and the year and type alias). */
export interface CdaReport extends CdaReportRow {
  type: CdaReportType;
  display_status: CdaDisplayStatus;
  /** Financial statements and the sworn statement move through stages. */
  stage: string | null;
  locked: boolean;
  stale: boolean;
  provisional: boolean;
  readiness: number;
  readiness_label: string;
  readiness_breakdown: CdaReadinessBreakdown | null;
  critical_count: number;
  warning_count: number;
  issues: CdaIssue[];
  sections: CdaSection[];
  snapshot: CdaSnapshotSummary | null;
  snapshot_checksum: string | null;
  finalized_at: string | null;
  refreshed_at: string | null;
  validated_at: string | null;
  updated_at: string | null;
  submitted_for_review_by: CdaUserRef | null;
  submitted_for_review_at: string | null;
  approved_by: CdaUserRef | null;
  approved_at: string | null;
  finalized_by: CdaUserRef | null;
  available_actions: CdaWorkflowAction[];
  history: CdaHistoryEvent[];
}

/** One field of `PUT /cda/reports/{id}`. */
export interface CdaFieldInput {
  field_key: string;
  value?: CdaFieldValue;
  remarks?: string | null;
  override_reason?: string | null;
  evidence?: CdaEvidence[] | null;
  /** Drop an override and go back to the source's figure. */
  revert?: boolean;
}

export type CdaSubmissionMethod = "cais" | "ecoophub" | "email" | "physical" | "other";

export interface CdaSubmissionInput {
  method: CdaSubmissionMethod;
  submitted_on: string;
  submitted_by_name?: string | null;
  cda_reference_no?: string | null;
  acknowledgment_no?: string | null;
  remarks?: string | null;
}

export interface CdaWorkflowInput {
  action: CdaWorkflowAction;
  reason?: string;
  confirm_warnings?: boolean;
  stage?: string;
  submission?: CdaSubmissionInput;
}

/** `POST /cda/reports/{id}/exports` (201) and each row of its list. */
export interface CdaExport {
  id: number;
  document_id: number;
  version: number;
  format: "pdf" | "xlsx";
  is_draft: boolean;
  file_name: string | null;
  sha256: string;
  snapshot_version: number | null;
  notes: string | null;
  url: string;
  generated_by: CdaUserRef | null;
  generated_at: string;
}

export type CdaExportFormat = CdaExport["format"];

// ── Loan classification (read only) ──

export type CdaAgingBucket = "current" | "1_30" | "31_60" | "61_90" | "91_120" | "over_120";

export interface CdaClassificationRow {
  bucket: CdaAgingBucket;
  classification: string;
  dpd_range: string;
  loan_count: number;
  outstanding_principal: string;
  required_rate: string;
  required_allowance: string;
}

export interface CdaClassificationLoan {
  loan_id: number;
  account_number: string;
  member: { id: number; name: string | null; code: string | null };
  branch: { id: number; name: string | null } | null;
  bucket: CdaAgingBucket;
  classification: string;
  days_past_due: number;
  oldest_late_due_date: string | null;
  is_past_due: boolean;
  outstanding_principal: string;
  total_outstanding: string;
  past_due_amount: string;
  unpaid_interest_due: string;
}

export interface CdaLoanClassification {
  year: number;
  as_of: string;
  basis: string;
  captured_at: string | null;
  provisional: boolean;
  warning: string | null;
  basis_note: string | null;
  rows: CdaClassificationRow[];
  total_loan_count: number;
  total_outstanding_principal: string;
  required_allowance: string;
  existing_allowance: string;
  existing_allowance_unassigned: string;
  provision_gap: string;
  unpaid_interest_due: string;
  memo_note: string;
  loans_visible: boolean;
  loans: CdaClassificationLoan[] | null;
}

export interface CdaPageMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

/** The classification body with its loan page's meta (null without `loans:view`). */
export interface CdaLoanClassificationPage {
  data: CdaLoanClassification;
  meta: CdaPageMeta | null;
}

// ── Enhanced PESOS (read only; every figure a string from the server) ──

export type CdaPesosStatus = "scored" | "missing_data" | "not_computable";

export interface CdaPesosComponent {
  key: string;
  label: string;
  weight: string;
  score: string | null;
}

export interface CdaPesosMetric {
  key: string;
  component: string;
  label: string;
  formula_key: string;
  formula: string;
  direction: "higher_better" | "lower_better";
  unit: string;
  numerator: string | null;
  denominator: string | null;
  denominator_opening: string | null;
  sources: Record<string, string>;
  source: string;
  value: string | null;
  score: string | null;
  weight: string;
  band: number | null;
  recommendation: string | null;
  status: CdaPesosStatus;
  note: string | null;
  to_verify: boolean;
}

export interface CdaPesos {
  year: number;
  as_of: string;
  template: { id: number; version: string; name: string } | null;
  verified: boolean;
  provisional: boolean;
  complete: boolean;
  score: string | null;
  rating: string | null;
  components: CdaPesosComponent[];
  metrics: CdaPesosMetric[];
  trend: { year: number; score: string | null }[];
  to_verify: string[];
  disclosure: string;
}

/**
 * The year's Enhanced PESOS rating quoted in the notes to the financial
 * statements (`GET /accounting/statements/notes`): the finalized PESOS
 * report's frozen figures, else the live result marked provisional. Every
 * figure is null when the year has no CDA reporting period.
 */
export interface StatementNotesPesos {
  year: number;
  /** A 2-decimal string. */
  score: string | null;
  /** Null until every indicator is scored. */
  rating: string | null;
  source: "finalized" | "live" | null;
  provisional: boolean | null;
  finalized_at: string | null;
  verified: boolean;
  disclosure: string | null;
}

export interface StatementNotes {
  pesos: StatementNotesPesos;
}

// ── Registers ──

export type CdaOfficerPosition =
  | "chairperson"
  | "vice_chairperson"
  | "board_member"
  | "secretary"
  | "treasurer"
  | "general_manager"
  | "committee_chairperson"
  | "committee_member"
  | "manager"
  | "bookkeeper"
  | "other";

export type CdaOfficerStatus = "active" | "inactive" | "resigned" | "removed";
export type CdaSex = "male" | "female";

export interface CdaOfficer {
  id: number;
  borrower_id: number | null;
  /** The linked member: name and code only. */
  member: { id: number; name: string; code: string | null } | null;
  user_id: number | null;
  name: string | null;
  sex: CdaSex | null;
  position: CdaOfficerPosition;
  position_label: string;
  committee: string | null;
  position_title: string | null;
  term_start: string;
  term_end: string | null;
  election_date: string | null;
  status: CdaOfficerStatus;
  remarks: string | null;
  trainings: {
    required: number;
    completed: number;
    missing: string[];
    status: string;
  };
}

export type CdaTrainingStatus = "completed" | "incomplete" | "scheduled" | "expired" | "not_required";

/** A document version as the registers present it, with its signed link. */
export interface CdaDocumentVersion {
  id: number;
  version: number;
  version_label: string | null;
  is_final: boolean;
  origin: "uploaded" | "generated";
  format: string | null;
  is_draft: boolean;
  snapshot_id: number | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  sha256: string | null;
  notes: string | null;
  uploaded_by: CdaUserRef | null;
  created_at: string;
  url: string | null;
}

export interface CdaTraining {
  id: number;
  officer_id: number;
  officer: { id: number; name: string | null; position: CdaOfficerPosition } | null;
  title: string;
  requirement_key: string | null;
  training_type: string | null;
  is_mandatory: boolean;
  provider: string | null;
  provider_accreditation_no: string | null;
  started_on: string | null;
  completed_on: string | null;
  hours: string;
  certificate_number: string | null;
  status: CdaTrainingStatus;
  expires_on: string | null;
  remarks: string | null;
  certificate: (CdaDocumentVersion & { cda_document_id: number; status: string }) | null;
}

export type CdaSocialCategory =
  | "member_education"
  | "financial_literacy"
  | "education"
  | "health"
  | "environment"
  | "community"
  | "youth"
  | "livelihood"
  | "disaster_response"
  | "other";

export type CdaFundingSource = "cdf" | "general_fund" | "cetf" | "external" | "other";
export type CdaSocialStatus = "planned" | "ongoing" | "completed" | "cancelled";

export interface CdaSocialProgram {
  id: number;
  period_id: number;
  year: number;
  name: string;
  category: CdaSocialCategory;
  category_label: string;
  description: string | null;
  objective: string | null;
  held_on: string | null;
  ended_on: string | null;
  location: string | null;
  target_beneficiaries: number | null;
  actual_beneficiaries: number | null;
  budget: string | null;
  actual_expense: string;
  funding_source: CdaFundingSource | null;
  funding_source_label: string | null;
  cdf_amount: string;
  status: CdaSocialStatus;
  responsible_officer: { id: number; name: string | null } | null;
  remarks: string | null;
}

/** The server's totals over ongoing and completed programs. */
export interface CdaSocialTotals {
  count: number;
  beneficiaries: number;
  budget: string;
  actual_expense: string;
  cdf_amount: string;
}

export type CdaMediationStatus = "pending" | "in_mediation" | "resolved" | "escalated" | "withdrawn";

export interface CdaMediationCase {
  id: number;
  case_number: string;
  filed_on: string;
  year: number;
  /** The halves of `year` the case belongs to, worked out by the server. */
  halves: ("h1" | "h2")[];
  complainant: string | null;
  respondent: string | null;
  nature: string | null;
  description: string | null;
  mediator: string | null;
  mediation_started_on: string | null;
  meetings_count: number;
  resolution: string | null;
  resolved_on: string | null;
  status: CdaMediationStatus;
  status_label: string;
  remarks: string | null;
}

export type CdaDocumentCategory =
  | "capr"
  | "financial_statements"
  | "audit_report"
  | "performance_audit"
  | "social_audit"
  | "pesos"
  | "officers_trainings"
  | "mediation"
  | "sworn_statement"
  | "atir"
  | "abr"
  | "tax"
  | "minutes"
  | "certificates"
  | "submission_proof"
  | "report_export"
  | "other";

export interface CdaDocument {
  id: number;
  period_id: number | null;
  year: number | null;
  category: CdaDocumentCategory;
  category_label: string;
  report_id: number | null;
  report_type: CdaReportType | null;
  report_part: CdaReportPart | null;
  report_title: string | null;
  subject_type: string | null;
  subject_id: number | null;
  title: string;
  description: string | null;
  status: "active" | "withdrawn";
  withdraw_reason: string | null;
  expires_on: string | null;
  version_count: number;
  current_version: CdaDocumentVersion | null;
  final_version: CdaDocumentVersion | null;
  created_by: CdaUserRef | null;
  created_at: string | null;
}

export type CdaSubmissionStatus = "submitted" | "acknowledged" | "accepted" | "returned" | "requires_correction";

export interface CdaSubmission {
  id: number;
  report_id: number;
  report_type: CdaReportType;
  part: CdaReportPart;
  title: string;
  title_part: string;
  snapshot: { id: number; version: number; checksum: string } | null;
  method: CdaSubmissionMethod;
  submitted_on: string | null;
  submitted_by_name: string | null;
  recorded_by: CdaUserRef | null;
  cda_reference_no: string | null;
  acknowledgment_no: string | null;
  status: CdaSubmissionStatus;
  remarks: string | null;
  proof: (CdaDocumentVersion & { cda_document_id: number }) | null;
}

// ── Settings ──

export type CdaCooperativeCategory = "primary" | "secondary" | "tertiary" | "federation" | "union";
export type CdaAssetClass = "micro" | "small" | "medium" | "large";
export type CdaCteStatus = "none" | "valid" | "pending" | "expired";

/** The regulatory profile's own fields, as stored. */
export interface CdaProfileFields {
  previous_name: string | null;
  cda_registration_no: string | null;
  cda_registration_date: string | null;
  cda_region: string | null;
  cda_extension_office: string | null;
  cooperative_type: string | null;
  cooperative_category: CdaCooperativeCategory | null;
  asset_class: CdaAssetClass | null;
  asset_class_source: "computed" | "manual";
  tin: string | null;
  cte_status: CdaCteStatus;
  cte_number: string | null;
  cte_issued_on: string | null;
  cte_expires_on: string | null;
  address_line: string | null;
  address_barangay: string | null;
  address_city: string | null;
  address_province: string | null;
  address_region: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  primary_activity: string | null;
  sector: string | null;
  subsector: string | null;
  satellite_offices: number | null;
  authorized_rep_officer_id: number | null;
}

export interface CdaRegulatoryProfile {
  stored: CdaProfileFields;
  /** Read-only values from elsewhere, each with where it comes from. */
  pulled: Record<string, { value: string | number | null; source: string }>;
  asset_class_suggested: {
    asset_class: CdaAssetClass;
    total_assets: string;
    as_of: string;
    source: string;
  } | null;
  updated_by: CdaUserRef | null;
  updated_at: string | null;
}

export interface CdaSettings {
  annual_deadline_days: number;
  mediation_deadline_days: number;
  reminder_days: number[];
  required_trainings: Partial<Record<CdaOfficerPosition, string[]>>;
  asset_class_thresholds: Partial<Record<"micro" | "small" | "medium", string>>;
  updated_by: CdaUserRef | null;
  updated_at: string | null;
}

export type CdaTemplateStatus = "draft" | "active" | "retired";

export interface CdaTemplate {
  id: number;
  report_type: CdaReportType;
  name: string;
  version: string;
  effective_from: string;
  effective_until: string | null;
  cooperative_types: string[];
  asset_classes: CdaAssetClass[];
  status: CdaTemplateStatus;
  reason: string | null;
  verified: boolean;
  definition: Record<string, unknown>;
  excel_template: { document_id: number; file_name: string | null } | null;
  created_by: CdaUserRef | null;
  activated_at: string | null;
}

export interface CdaTemplateInput {
  report_type?: CdaReportType;
  version: string;
  name: string;
  effective_from: string;
  effective_until: string | null;
  cooperative_types: string[];
  asset_classes: CdaAssetClass[];
  definition: Record<string, unknown>;
}

export interface CdaTemplateValidation {
  valid: boolean;
  errors: { path: string; message: string }[];
}
