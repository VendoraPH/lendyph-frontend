/**
 * CDA Compliance — the annual reports a cooperative files with the
 * Cooperative Development Authority (CAPR, audited financial statements,
 * performance and social audits, PESOS, sworn statement, ATIR/ABR, …).
 *
 * None of the `/cda/*` routes exist on lendyph-backend yet. This file is the
 * contract the screens are built against; `docs/CDA_BACKEND_HANDOFF.md`
 * describes what each endpoint must do. Until they land every screen shows
 * "Not connected yet" (404/501).
 *
 * Reports are TEMPLATE-DRIVEN on purpose: CDA revises its forms, and a form
 * that changes every year must not need a frontend release. The server sends
 * each report as sections of typed fields (from the template in force for the
 * reporting year), and the screens render whatever arrives.
 */

// ── Reporting periods ───────────────────────────────────────────────────────

export interface CdaReportingPeriod {
  id: number;
  /** The fiscal year being reported on, e.g. 2025 for reports filed in 2026. */
  year: number;
  /** YYYY-MM-DD. Usually December 31, but a cooperative may close otherwise. */
  fiscal_year_end: string;
  /** Default deadline: fiscal year-end + `deadline_days` (120 by default). */
  default_deadline: string;
  /** Set when CDA extended the deadline for this year. */
  extended_deadline: string | null;
  status: "open" | "closed";
}

// ── Report types and statuses ───────────────────────────────────────────────

export type CdaReportType =
  | "capr"
  | "financial_statements"
  | "performance_audit"
  | "social_audit"
  | "pesos"
  | "officers"
  | "mediation"
  | "sworn_statement"
  | "atir_abr";

/** One status list for every report, so badges and the workflow are shared. */
export type CdaReportStatus =
  | "not_started"
  | "draft"
  | "validation_failed"
  | "for_review"
  | "returned"
  | "approved"
  | "finalized"
  | "submitted"
  | "accepted"
  | "correction_required";

export type CdaSeverity = "critical" | "warning" | "info";

export interface CdaValidationIssue {
  id: string;
  severity: CdaSeverity;
  message: string;
  report_type: CdaReportType;
  /** The section/field the issue is about, so the screen can point at it. */
  section_key?: string | null;
  field_key?: string | null;
  /** Where to fix it, e.g. "/borrowers" for a member missing a TIN. */
  fix_href?: string | null;
}

// ── Template-driven report content ─────────────────────────────────────────

export type CdaFieldType =
  | "text"
  | "textarea"
  | "number"
  | "money"
  | "percent"
  | "date"
  | "select"
  | "boolean"
  /** Compliant / Partially Compliant / Non-Compliant / N/A, for audits. */
  | "compliance";

export type CdaComplianceRating = "compliant" | "partial" | "non_compliant" | "not_applicable";

export type CdaFieldValue = string | number | boolean | null;

export interface CdaField {
  key: string;
  label: string;
  type: CdaFieldType;
  value: CdaFieldValue;
  /**
   * Where an auto-pulled value came from, e.g. "Members", "Loans",
   * "Share Capital", "Accounting · Closed period Dec 2025". Null when typed in.
   */
  source: string | null;
  /** False for auto-pulled values: fix them at the source, not here. */
  editable: boolean;
  required: boolean;
  options?: { value: string; label: string }[];
  help?: string | null;
  /** Free-text remark next to the value, used by audit checklists. */
  remarks?: string | null;
}

export interface CdaTableColumn {
  key: string;
  label: string;
  format?: "text" | "number" | "money" | "percent" | "date";
}

export type CdaSection =
  | { kind: "fields"; key: string; title: string; description?: string | null; fields: CdaField[] }
  | {
      kind: "table";
      key: string;
      title: string;
      description?: string | null;
      columns: CdaTableColumn[];
      rows: Record<string, CdaFieldValue>[];
    };

export interface CdaWorkflowEvent {
  id: number;
  action: string;
  from_status: CdaReportStatus | null;
  to_status: CdaReportStatus;
  user_name: string;
  reason: string | null;
  created_at: string;
}

export interface CdaReport {
  id: number;
  type: CdaReportType;
  year: number;
  status: CdaReportStatus;
  /** 0–100, from the server's readiness engine. */
  readiness: number;
  /** Finalized and later reports are locked; edits need a reopen with a reason. */
  locked: boolean;
  template: { id: number; name: string; version: string } | null;
  sections: CdaSection[];
  issues: CdaValidationIssue[];
  /** SHA-256 of the snapshot taken on finalize. */
  snapshot_checksum: string | null;
  finalized_at: string | null;
  updated_at: string | null;
  history: CdaWorkflowEvent[];
}

/** Manual values only; auto-pulled fields are rejected by the server. */
export interface CdaReportUpdate {
  fields: { section_key: string; field_key: string; value: CdaFieldValue; remarks?: string | null }[];
}

export type CdaWorkflowAction =
  | "validate"
  | "submit_for_review"
  | "return"
  | "approve"
  | "finalize"
  | "reopen"
  | "mark_submitted"
  | "mark_accepted"
  | "mark_correction_required";

export interface CdaWorkflowRequest {
  action: CdaWorkflowAction;
  /** Required for `return`, `reopen` and `mark_correction_required`. */
  reason?: string;
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export interface CdaReportSummary {
  type: CdaReportType;
  status: CdaReportStatus;
  readiness: number;
  critical: number;
  warnings: number;
  /** False when the report does not apply to this cooperative (ATIR/ABR without CTE). */
  applicable: boolean;
  updated_at: string | null;
}

export interface CdaDashboard {
  period: CdaReportingPeriod;
  /** "Lendy CDA Readiness": 0–100 over the applicable reports. */
  readiness: number;
  reports: CdaReportSummary[];
  issues: CdaValidationIssue[];
}

// ── Regulatory profile, settings, templates ────────────────────────────────

export type CdaCteStatus = "yes" | "no" | "pending" | "expired";

export interface CdaRegulatoryProfile {
  registered_name: string;
  cda_registration_number: string;
  registration_date: string | null;
  tin: string;
  cooperative_type: string;
  cooperative_category: "micro" | "small" | "medium" | "large" | "";
  asset_size_class: string;
  area_of_operation: string;
  principal_office_address: string;
  cda_extension_office: string;
  cte_status: CdaCteStatus;
  cte_number: string;
  cte_expiry: string | null;
  bir_rdo: string;
  external_auditor: string;
  external_auditor_accreditation: string;
  fiscal_year_end_month: number;
  chairperson: string;
  general_manager: string;
  treasurer: string;
  secretary: string;
  compliance_officer: string;
  contact_email: string;
  contact_phone: string;
}

export interface CdaSettings {
  /** Days after fiscal year-end the reports are due. CDA's default is 120. */
  deadline_days: number;
  /** Days before a deadline to notify staff; plus "due" and "overdue". */
  reminder_days: number[];
  /** Roles notified of deadlines and status changes. */
  notify_roles: string[];
}

export type CdaTemplateStatus = "draft" | "active" | "retired";

export interface CdaTemplate {
  id: number;
  report_type: CdaReportType;
  name: string;
  version: string;
  effective_from: string;
  effective_until: string | null;
  /** Empty means every cooperative type / asset class. */
  cooperative_types: string[];
  asset_classes: string[];
  status: CdaTemplateStatus;
  /** Field and rule definitions; edited as JSON by the template manager. */
  definition: Record<string, unknown>;
  updated_at: string | null;
}

export type CdaTemplateInput = Omit<CdaTemplate, "id" | "updated_at">;

// ── Loan classification (read-only) ────────────────────────────────────────

export interface CdaLoanClassificationRow {
  classification: string;
  dpd_range: string;
  loan_count: number;
  outstanding_balance: number;
  /** Percent of the balance CDA requires as allowance. */
  required_rate: number;
  required_allowance: number;
}

export interface CdaLoanClassification {
  as_of: string;
  rows: CdaLoanClassificationRow[];
  total_balance: number;
  required_allowance: number;
  existing_allowance: number;
  /** required − existing; positive means under-provisioned. */
  provision_gap: number;
}

// ── PESOS ───────────────────────────────────────────────────────────────────

export interface CdaPesosMetric {
  key: string;
  component: string;
  label: string;
  formula: string;
  source: string;
  value: number | null;
  score: number | null;
  weight: number;
}

export interface CdaPesosAssessment {
  year: number;
  score: number | null;
  rating: string | null;
  components: { key: string; label: string; score: number | null; weight: number }[];
  metrics: CdaPesosMetric[];
  trend: { year: number; score: number | null }[];
}

// ── Registers (officers, trainings, programs, cases, documents, submissions) ─

export interface CdaOfficer {
  id: number;
  borrower_id: number | null;
  name: string;
  position: string;
  committee: string;
  term_start: string;
  term_end: string | null;
  status: "active" | "inactive";
  /** Hours of the mandatory training CDA requires for the position. */
  required_training_hours: number;
  completed_training_hours: number;
}

export interface CdaTraining {
  id: number;
  officer_id: number;
  officer_name?: string;
  title: string;
  provider: string;
  date: string;
  hours: number;
  certificate_url: string | null;
}

export type CdaSocialCategory =
  | "education"
  | "health"
  | "environment"
  | "community"
  | "youth"
  | "livelihood"
  | "disaster_response"
  | "other";

export interface CdaSocialProgram {
  id: number;
  name: string;
  category: CdaSocialCategory;
  date: string;
  beneficiaries: number;
  amount_spent: number;
  fund_source: string;
  description: string;
}

export type CdaMediationStatus = "pending" | "in_mediation" | "resolved" | "escalated" | "withdrawn";

export interface CdaMediationCase {
  id: number;
  case_number: string;
  /** H1 (Jan–Jun) or H2 (Jul–Dec): CDA asks for the report per semester. */
  semester: "H1" | "H2";
  filed_date: string;
  parties: string;
  nature: string;
  status: CdaMediationStatus;
  mediator: string;
  resolved_date: string | null;
  remarks: string;
}

export type CdaDocumentCategory =
  | "capr"
  | "financial_statements"
  | "audit_report"
  | "performance_audit"
  | "social_audit"
  | "sworn_statement"
  | "tax"
  | "minutes"
  | "certificates"
  | "other";

export interface CdaDocumentVersion {
  id: number;
  version: number;
  file_name: string;
  file_url: string;
  uploaded_by: string;
  uploaded_at: string;
  notes: string | null;
}

export interface CdaComplianceDocument {
  id: number;
  title: string;
  category: CdaDocumentCategory;
  report_type: CdaReportType | null;
  /** The latest version; older ones are kept, never overwritten. */
  current_version: CdaDocumentVersion;
  version_count: number;
}

export type CdaSubmissionMethod = "cais" | "ecoophub" | "email" | "physical" | "other";

export type CdaSubmissionStatus =
  | "prepared"
  | "submitted"
  | "acknowledged"
  | "accepted"
  | "returned"
  | "requires_correction";

export interface CdaSubmission {
  id: number;
  report_type: CdaReportType;
  method: CdaSubmissionMethod;
  submitted_date: string | null;
  reference_number: string;
  status: CdaSubmissionStatus;
  submitted_by: string;
  remarks: string;
  proof_url: string | null;
}

// ── Calendar ────────────────────────────────────────────────────────────────

export interface CdaCalendarEntry {
  report_type: CdaReportType;
  title: string;
  default_deadline: string;
  extended_deadline: string | null;
  status: CdaReportStatus;
}
