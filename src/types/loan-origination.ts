/**
 * Loan Origination: online applications from public links, their documents,
 * the preliminary capacity assessment and the hand-off into the loan module.
 *
 * The backend for all of this is still to be built. These types are the
 * contract the screens are written against; the handoff that lists the
 * endpoints is `docs/LOAN_ORIGINATION_BACKEND_HANDOFF.md`. Money is a number
 * of pesos with centavos, as everywhere else in the app; the server computes
 * every figure with decimal precision and the browser only shows it.
 */

import type { PaginatedResponse } from "./api";

// ── Statuses ────────────────────────────────────────────────────────────────

export type ApplicationStatus =
  | "draft"
  | "incomplete"
  | "submitted"
  | "document_verification"
  | "additional_info_required"
  | "under_assessment"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "converted"
  | "expired";

/** What an applicant is told, never the internal status itself. */
export type BorrowerFacingStatus =
  | "draft"
  | "received"
  | "under_review"
  | "additional_info_required"
  | "decision_available"
  | "approved"
  | "not_approved"
  | "withdrawn"
  | "expired";

export type DocumentStatus =
  | "not_submitted"
  | "uploaded"
  | "pending_verification"
  | "verified"
  | "rejected"
  | "replacement_requested";

export type AssessmentResult =
  | "within_capacity"
  | "further_review"
  | "above_capacity"
  | "insufficient_information";

export type IncomeSource =
  | "employed"
  | "self_employed"
  | "business_owner"
  | "farmer"
  | "pensioner"
  | "other";

export type IncomeFrequency =
  | "daily"
  | "weekly"
  | "bi_weekly"
  | "semi_monthly"
  | "monthly"
  | "quarterly"
  | "semi_annual"
  | "annual";

// ── Applicant data (what the wizard collects) ──────────────────────────────

export interface ApplicantPersonal {
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
  date_of_birth: string;
  gender: string;
  civil_status: string;
  nationality: string;
  region: string;
  province: string;
  city: string;
  barangay: string;
  street_address: string;
  postal_code: string;
  /** Years at the current address. */
  years_at_residence: string;
  residence_ownership: string;
  dependents: string;
  membership_number: string;
  branch_id: number | null;
}

export interface ApplicantEmployment {
  income_source: IncomeSource | "";
  // Employed
  employer_name: string;
  employment_type: string;
  job_title: string;
  years_employed: string;
  employer_address: string;
  gross_monthly_income: string;
  net_monthly_income: string;
  other_regular_income: string;
  salary_frequency: IncomeFrequency | "";
  // Self-employed and business owners
  business_name: string;
  business_type: string;
  business_address: string;
  years_operating: string;
  monthly_revenue: string;
  monthly_business_expenses: string;
  monthly_net_business_income: string;
  // Farmers, pensioners and other sources
  other_source_description: string;
  other_income_amount: string;
  other_income_frequency: IncomeFrequency | "";
  other_income_details: string;
}

export interface ExistingDebt {
  institution: string;
  outstanding_balance: string;
  payment_amount: string;
  payment_frequency: IncomeFrequency | "";
  remaining_term: string;
}

export interface ApplicantExpenses {
  housing: string;
  utilities: string;
  food: string;
  transportation: string;
  education: string;
  family_support: string;
  other_essential: string;
  credit_card_payments: string;
  other_debt_payments: string;
  other_commitments: string;
  has_existing_loans: boolean | null;
  existing_loans: ExistingDebt[];
}

export interface ApplicantLoanRequest {
  loan_product_id: number | null;
  amount: string;
  purpose: string;
  term: string;
  frequency: string;
  release_method: string;
}

/** The whole draft, as the wizard keeps it and the server stores it. */
export interface ApplicationDraft {
  personal: ApplicantPersonal;
  employment: ApplicantEmployment;
  expenses: ApplicantExpenses;
  loan: ApplicantLoanRequest;
}

// ── Public portal ──────────────────────────────────────────────────────────

/** A loan product as a public link offers it. */
export interface PublicLoanProduct {
  id: number;
  name: string;
  description: string | null;
  eligible_applicants: string | null;
  min_amount: number;
  max_amount: number;
  min_term: number;
  max_term: number;
  term_unit: "months" | "days";
  payment_frequencies: string[];
  interest_method: string;
  interest_rate: number;
  interest_rate_frequency: string;
  eligibility: string | null;
  instructions: string | null;
}

export interface DocumentRequirement {
  /** Stable key, e.g. `government_id`, `payslip`. */
  type: string;
  label: string;
  description: string | null;
  required: boolean;
}

/** A text the applicant accepts, by version. */
export interface ConsentText {
  version: string;
  text: string;
  /**
   * True once it is the owner's approved wording. Absent or false: the screen
   * marks it as a draft (staging carries placeholder text until the owner signs).
   */
  final?: boolean;
}

/** `GET /public/apply/{token}`: everything the landing page shows. */
export interface PublicApplicationPortal {
  organization: {
    name: string;
    logo_url: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    address: string | null;
  };
  /** False when online applications are off, or the link is disabled or expired. */
  accepting: boolean;
  closed_reason: string | null;
  welcome_heading: string;
  intro: string | null;
  eligibility: string | null;
  estimated_minutes: number | null;
  privacy_notice: ConsentText;
  terms: ConsentText;
  credit_authorization: ConsentText | null;
  declaration: ConsentText;
  products: PublicLoanProduct[];
  /** Documents the applicant may be asked for, for the landing page list. */
  documents: DocumentRequirement[];
  branches: { id: number; name: string }[];
  /** Upload limits, so the browser can refuse a file before sending it. */
  accepted_file_types: string[];
  max_upload_mb: number;
  otp_channels: ("sms" | "email")[];
}

export interface OtpRequestResult {
  /** Seconds until another code may be requested. */
  resend_after: number;
  expires_in: number;
  channel: "sms" | "email";
  /** Where the code went, masked (`0917•••4321`). */
  destination: string;
  /**
   * True only when a provider actually sent the message. Sending is log-only
   * until the owner signs, so absent or false means nothing went out.
   */
  delivered?: boolean;
}

/** `POST …/remind`: what happened to the reminder. */
export interface ReminderResult {
  channel: string;
  sent_at: string | null;
  /** True only when a provider actually sent it; absent or false: logged only. */
  delivered?: boolean;
}

/**
 * `POST …/otp/verify`: a session for this one application, sent back as
 * `X-Application-Session`. Resuming returns the saved draft with it.
 */
export interface ApplicationSession {
  session_token: string;
  expires_at: string;
  application: PublicApplicationState | null;
}

export interface PublicApplicationState {
  reference_number: string | null;
  status: ApplicationStatus;
  last_completed_step: string | null;
  completion_percent: number;
  draft: ApplicationDraft;
  documents: ApplicationDocument[];
  /** Products this applicant may choose; the link's list, server-filtered. */
  verified_contact: { mobile: string | null; email: string | null };
}

export interface LoanEstimate {
  installment: number;
  installments_count: number;
  frequency: string;
  total_interest: number;
  total_charges: number;
  total_repayment: number;
  net_proceeds: number;
  charges: { name: string; amount: number }[];
  schedule: { number: number; due_date: string; principal: number; interest: number; amount: number }[];
  assumptions: string[];
}

export interface SubmitResult {
  reference_number: string;
  submitted_at: string;
}

export interface ConsentAcceptance {
  privacy_notice_version: string;
  terms_version: string;
  declaration_version: string;
  credit_authorization_version: string | null;
  /** Optional permissions are recorded apart from the required ones. */
  marketing_opt_in: boolean;
}

export interface PublicTrackingResult {
  reference_number: string;
  submitted_at: string | null;
  status: BorrowerFacingStatus;
  status_message: string | null;
  outstanding_requirements: string[];
  requested_actions: string[];
  /** Documents the applicant may replace now. */
  replaceable_documents: ApplicationDocument[];
  decision_notice: string | null;
  contact: { phone: string | null; email: string | null };
}

// ── Staff side ─────────────────────────────────────────────────────────────

export interface ApplicationSummary {
  id: number;
  reference_number: string | null;
  applicant_name: string;
  /** Masked by the server unless the user may see contacts. */
  mobile: string | null;
  loan_product_name: string | null;
  requested_amount: number | null;
  branch_name: string | null;
  submitted_at: string | null;
  started_at: string;
  updated_at: string;
  status: ApplicationStatus;
  assessment_result: AssessmentResult | null;
  assigned_officer_name: string | null;
  completion_percent: number;
  last_completed_step: string | null;
}

export interface StatusHistoryEntry {
  id: number;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  note: string | null;
  changed_by_name: string | null;
  changed_at: string;
}

export interface ApplicationNote {
  id: number;
  body: string;
  author_name: string;
  created_at: string;
}

export interface DocumentVersion {
  id: number;
  file_name: string;
  uploaded_at: string;
  status: DocumentStatus;
}

export interface ApplicationDocument {
  id: number;
  type: string;
  label: string;
  required: boolean;
  status: DocumentStatus;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string | null;
  /** Short-lived signed URL; only sent to users who may open the file. */
  preview_url: string | null;
  verified_by_name: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  versions: DocumentVersion[];
}

/** One row of the cross-application Documents page. */
export interface DocumentQueueItem extends ApplicationDocument {
  application_id: number;
  reference_number: string | null;
  applicant_name: string;
}

export interface AssessmentFigures {
  declared_monthly_income: number | null;
  verified_monthly_income: number | null;
  eligible_monthly_income: number | null;
  monthly_expenses: number | null;
  monthly_debt_payments: number | null;
  disposable_income: number | null;
  proposed_monthly_installment: number | null;
  /** Percent, e.g. 38.5. */
  dti_ratio: number | null;
  coverage_ratio: number | null;
  remaining_income: number | null;
}

export interface AssessmentThresholds {
  max_dti: number;
  min_coverage: number;
  min_remaining_income: number;
}

export interface Assessment {
  id: number;
  version: number;
  application_id: number;
  reference_number: string | null;
  applicant_name: string;
  loan_product_name: string | null;
  requested_amount: number | null;
  result: AssessmentResult;
  /** True while income or debts are missing or unverified. */
  provisional: boolean;
  figures: AssessmentFigures;
  thresholds: AssessmentThresholds;
  explanation: string;
  missing_information: string[];
  conflicts: string[];
  document_status: string | null;
  officer_findings: string | null;
  recommendations: string | null;
  rules_version: string;
  assessed_at: string;
}

export interface ApplicationDetail extends ApplicationSummary {
  email: string | null;
  branch_id: number | null;
  loan_product_id: number | null;
  assigned_officer_id: number | null;
  draft: ApplicationDraft;
  documents: ApplicationDocument[];
  assessment: Assessment | null;
  notes: ApplicationNote[];
  history: StatusHistoryEntry[];
  missing_fields: string[];
  missing_documents: string[];
  consents: { type: string; version: string; accepted_at: string }[];
  /** Set once converted; the loan it became. */
  loan_id: number | null;
  /** An existing member the server matched for review, never auto-linked. */
  possible_member_matches: { id: number; name: string; member_number: string | null; reason: string }[];
  linked_borrower_id: number | null;
}

export interface ApplicationListFilters {
  page?: number;
  per_page?: number;
  search?: string;
  status?: ApplicationStatus;
  branch_id?: number;
  loan_product_id?: number;
  assessment_result?: AssessmentResult;
  date_from?: string;
  date_to?: string;
  sort?: string;
  direction?: "asc" | "desc";
}

export type ApplicationListResponse = PaginatedResponse<ApplicationSummary>;

export interface OriginationKpis {
  total: number;
  new: number;
  incomplete: number;
  submitted: number;
  pending_documents: number;
  under_assessment: number;
  pending_approval: number;
  approved: number;
  rejected: number;
  additional_info_required: number;
  amount_requested: number;
  amount_approved: number;
  /** Hours from submission to decision. */
  avg_processing_hours: number | null;
  /** Percent. */
  completion_rate: number | null;
  approval_rate: number | null;
}

export interface OriginationDashboard {
  period: { from: string; to: string };
  kpis: OriginationKpis;
  /** Same figures for the period before, for the comparison arrows. */
  previous: Partial<OriginationKpis> | null;
  trends: { date: string; completed: number; incomplete: number }[];
  by_status: { status: ApplicationStatus; count: number }[];
  by_product: { product: string; count: number }[];
  decisions: { date: string; approved: number; rejected: number }[];
  /** Average hours spent in each stage. */
  stage_times: { status: ApplicationStatus; avg_hours: number }[];
  recent: ApplicationSummary[];
}

export interface ApplicationLink {
  id: number;
  name: string;
  token: string;
  /** The full public URL, built by the server from the configured domain. */
  url: string;
  active: boolean;
  branch_id: number | null;
  branch_name: string | null;
  loan_product_ids: number[];
  loan_product_names: string[];
  expires_at: string | null;
  display_name: string | null;
  display_logo_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  visits: number;
  started: number;
  submitted: number;
  created_at: string;
}

export interface ApplicationLinkInput {
  name: string;
  active: boolean;
  branch_id: number | null;
  loan_product_ids: number[];
  expires_at: string | null;
  display_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
}

export interface OriginationSettings {
  general: {
    online_applications_enabled: boolean;
    default_branch_id: number | null;
    reference_format: string;
    draft_expiration_days: number;
    estimated_minutes: number | null;
  };
  products: {
    loan_product_id: number;
    online: boolean;
    required_fields: string[];
    eligibility: string | null;
    required_documents: string[];
    instructions: string | null;
  }[];
  assessment: AssessmentThresholds & {
    /** How each source's income counts toward eligible income, in percent. */
    income_recognition: Partial<Record<IncomeSource, number>>;
    require_verified_income: boolean;
    min_employment_years: number | null;
    missing_information_rule: "provisional" | "insufficient";
    product_overrides: ({ loan_product_id: number } & Partial<AssessmentThresholds>)[];
  };
  documents: {
    accepted_file_types: string[];
    max_upload_mb: number;
    retention_days: number;
    types: DocumentRequirement[];
  };
  notifications: {
    application_confirmation: boolean;
    incomplete_reminder: boolean;
    incomplete_reminder_after_days: number;
    document_request: boolean;
    status_change: boolean;
    decision: boolean;
  };
}
