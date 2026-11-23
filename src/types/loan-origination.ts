/**
 * Loan Origination: online applications from public links, their documents,
 * the preliminary capacity assessment and the hand-off into the loan module.
 *
 * The staff side (from "Staff side" down) follows the merged backend (LO-B1
 * to LO-B4): `routes/api/loan-origination/*`, the staff ApplicationPresenter,
 * DocumentPresenter and AssessmentPresenter, whose OpenAPI descriptions are
 * the contract. The server works out every figure with exact decimals; the
 * browser only shows it. Money arrives as a two-decimal string where the
 * server keeps a decimal column (`MoneyString`) and as a JSON number where a
 * presenter converts it (the assessment, the settings).
 */

import type { PaginatedResponse } from "./api";
import type { TurnaroundStretch } from "./executive-dashboard";
import type { MoneyString } from "./savings";

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

export interface DocumentVersion {
  id: number;
  file_name: string;
  uploaded_at: string;
  status: DocumentStatus;
}

/** A document as the public application reads it. Staff screens read `StaffDocument`. */
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

// ── Staff side ─────────────────────────────────────────────────────────────

/** A staff user as `SavingsUserRef` sends one. */
export interface StaffRef {
  id: number;
  name: string;
}

/** `ApplicationPresenter::summary()`: a list row, and the head of the detail. */
export interface ApplicationSummary {
  id: number;
  reference_number: string | null;
  applicant_name: string;
  /** Masked by the server without `borrowers:view` and the branch. */
  mobile: string | null;
  loan_product_id: number | null;
  loan_product_name: string | null;
  requested_amount: MoneyString | null;
  requested_term: number | null;
  branch_id: number | null;
  branch_name: string | null;
  status: ApplicationStatus;
  /** The status in words ("For Approval"), the server's label. */
  status_label: string;
  /** From a link marked as a test; left out of the dashboard. */
  is_test: boolean;
  assessment_result: AssessmentResult | null;
  assigned_officer_id: number | null;
  assigned_officer_name: string | null;
  completion_percent: number;
  last_completed_step: string | null;
  /** The loan the hand-off created; set from "Submit for approval" on. */
  loan_id: number | null;
  started_at: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  updated_at: string | null;
}

export interface StatusHistoryEntry {
  id: number;
  from_status: ApplicationStatus | null;
  from_label: string | null;
  to_status: ApplicationStatus;
  to_label: string;
  note: string | null;
  /** "Applicant", "System", "Loan approval" or the staff member's name. */
  changed_by_name: string;
  changed_at: string | null;
}

export interface ApplicationNote {
  id: number;
  body: string;
  author_name: string | null;
  created_at: string | null;
}

/** One declared line, a month, worked out by the server (`DraftRules::declaredTotals()`). */
export interface DeclaredLine {
  key: string;
  label: string;
  monthly: MoneyString;
}

/** The applicant's declared income, expenses and debts, each line a month, and their totals. */
export interface DeclaredTotals {
  /** Null when no income was declared. */
  monthly_income: MoneyString | null;
  monthly_expenses: MoneyString;
  monthly_debt_payments: MoneyString;
  /** Income less expenses and debts; null without income. */
  monthly_remaining: MoneyString | null;
  income: DeclaredLine[];
  expenses: DeclaredLine[];
  debts: DeclaredLine[];
}

/** A message meant for the applicant, recorded and never sent (`ApplicantMessages::present()`). */
export interface ApplicantMessage {
  id: number;
  kind: string;
  kind_label: string;
  channel: "sms" | "email" | null;
  channel_label: string;
  body: string;
  document_types: string[];
  delivery: "logged" | "sent";
  /** "Logged, not sent" while nothing can reach an applicant. */
  delivery_label: string;
  delivered: boolean;
  sent_at: string | null;
  author_name: string | null;
  created_at: string | null;
}

/** `POST …/remind`: the logged reminder. */
export interface ReminderResult extends ApplicantMessage {
  logged_at: string | null;
}

export interface MemberMatch {
  id: number;
  name: string;
  member_number: string | null;
  status: string;
  /** "Same full name", "Same mobile number" or "Same email address". */
  reason: string;
}

export interface StaffDocumentVersion {
  id: number;
  public_id: string;
  version: number;
  /** Null without `borrowers:view` and the branch: a file name can hold an address. */
  file_name: string | null;
  uploaded_at: string | null;
  scan_label: string | null;
  current: boolean;
}

/** `DocumentPresenter::present()`: a document as staff read it. */
export interface StaffDocument {
  id: number;
  public_id: string;
  type: string;
  label: string;
  required: boolean;
  status: DocumentStatus;
  status_label: string;
  /** Null without `borrowers:view` and the branch (the contacts rule). */
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  /** The current file's upload time; null while there is no file. */
  uploaded_at: string | null;
  scan_status: string | null;
  scan_label: string | null;
  verified_by_name: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  /** The hand-off files it as the member's valid ID, so verifying it records the ID type and number. */
  id_document: boolean;
  id_type: string | null;
  id_type_label: string | null;
  /** Null without the contacts rule. */
  id_number: string | null;
  versions: StaffDocumentVersion[];
}

/** One row of the documents queue. */
export interface DocumentQueueItem extends StaffDocument {
  application_id: number;
  reference_number: string | null;
  applicant_name: string;
}

/** A document decision's answer: the document and its application's version now. */
export interface DocumentDecision extends StaffDocument {
  application_id: number;
  application_version: number | null;
}

/** `POST …/documents/{id}/verify`. An ID also takes its type, its name for "others" and its number. */
export interface VerifyDocumentInput {
  notes?: string;
  id_type?: string;
  custom_type_name?: string;
  id_number?: string;
}

export interface AssessmentFigures {
  declared_monthly_income: number | null;
  verified_monthly_income: number | null;
  eligible_monthly_income: number | null;
  monthly_expenses: number | null;
  outside_debt_payments: number | null;
  /** Withheld (null) with the other member loan figures; see `member_figures_hidden`. */
  lendy_debt_payments: number | null;
  monthly_debt_payments: number | null;
  disposable_income: number | null;
  proposed_monthly_installment: number | null;
  /** Percent, two decimals rounded up, as the server sends it. */
  dti_ratio: number | null;
  /** Two decimals rounded down, as the server sends it. */
  coverage_ratio: number | null;
  remaining_income: number | null;
}

export interface AssessmentThresholds {
  max_dti: number;
  min_coverage: number;
  min_remaining_income: number;
}

/** Each limit as the server judged it: true passes, false fails, null not worked out. */
export interface AssessmentChecks {
  dti: boolean | null;
  coverage: boolean | null;
  remaining_income: boolean | null;
}

/** `AssessmentPresenter::present()`: one revision of an application's assessment. */
export interface Assessment {
  id: number;
  version: number;
  /** `run` for a run, `notes` for an officer's notes saved on the same figures. */
  kind: "run" | "notes";
  application_id: number;
  reference_number: string | null;
  applicant_name: string;
  loan_product_id: number | null;
  loan_product_name: string | null;
  requested_amount: number | null;
  requested_term: number | null;
  frequency: string | null;
  /** The loan's planned start date the run used. */
  start_date: string | null;
  result: AssessmentResult;
  result_label: string;
  /** True while the income or the debts aren't verified. */
  provisional: boolean;
  /** Above capacity or insufficient information: the hand-off goes to the Policy Exception chain. */
  policy_exception: boolean;
  figures: AssessmentFigures;
  /** The figures that count a linked member's loans are withheld from this viewer. */
  member_figures_hidden: boolean;
  thresholds: AssessmentThresholds;
  checks: AssessmentChecks;
  /** How the instalment was taken, in words. */
  instalment_basis: string | null;
  explanation: string;
  missing_information: string[];
  conflicts: string[];
  document_status: string | null;
  officer_findings: string | null;
  recommendations: string | null;
  rules_version: string;
  assessed_by: StaffRef | null;
  assessed_at: string | null;
}

/**
 * `POST …/assessment/rerun`: a figure left out keeps the last run's, and null
 * clears it (not verified: the declared figure counts). `start_date` is today
 * when left out.
 */
export interface RerunAssessmentInput {
  verified_monthly_income?: string | null;
  verified_debt_payments?: string | null;
  start_date?: string;
}

/** `ApplicationPresenter::detail()`. */
export interface ApplicationDetail extends ApplicationSummary {
  /** The version read; every staff write sends it back (409 when it moved on). */
  version: number;
  email: string | null;
  /** True when the mobile and email are masked and the address lines read "On file". */
  contacts_hidden: boolean;
  draft: ApplicationDraft;
  declared_totals: DeclaredTotals;
  /** Draft fields a submit still needs, as `section.field` keys. */
  missing_fields: string[];
  /** Required documents not handed in, by label. */
  missing_documents: string[];
  documents: StaffDocument[];
  /** The current revision as this viewer may see it; null before the first run. */
  assessment: Assessment | null;
  notes: ApplicationNote[];
  /** Newest first. */
  history: StatusHistoryEntry[];
  consents: { type: string; version: string; accepted: boolean; accepted_at: string | null }[];
  /** Newest first. */
  applicant_messages: ApplicantMessage[];
  linked_borrower_id: number | null;
  /** Suggestions only, never linked by themselves; empty when `member_matches_hidden`. */
  possible_member_matches: MemberMatch[];
  member_matches_hidden: boolean;
  /** The staff moves from this status that the viewer holds every permission for. */
  allowed_transitions: ApplicationStatus[];
}

/** `POST …/transition`. */
export interface TransitionInput {
  to: ApplicationStatus;
  version: number;
  /** Internal; stays in the history. */
  note?: string;
  /** For the applicant: logged, never sent. On a rejection or withdrawal it is the decision notice. */
  applicant_message?: string;
}

/** `POST …/submit-for-approval`: the hand-off. */
export interface HandOffInput {
  version: number;
  /** The loan's start date; today when left out. */
  start_date?: string;
  /** "Create anyway": create the member even when one on record looks the same. */
  force_new_member?: boolean;
}

/** The hand-off's answer: the application, now For Approval, and its loan. */
export interface HandOffResult {
  id: number;
  reference_number: string | null;
  status: ApplicationStatus;
  status_label: string;
  version: number;
  borrower_id: number | null;
  loan_id: number | null;
  loan_application_number: string | null;
  loan: { id: number; application_number: string; status: string; policy_exception: boolean };
}

export interface ApplicationListFilters {
  page?: number;
  per_page?: number;
  search?: string;
  status?: ApplicationStatus;
  branch_id?: number;
  loan_product_id?: number;
  officer_id?: number;
  assigned?: "me" | "none";
  is_test?: boolean;
  /** Started on or after (Manila days). */
  date_from?: string;
  date_to?: string;
  sort?: "submitted_at" | "started_at" | "updated_at" | "requested_amount" | "applicant_name" | "reference_number";
  direction?: "asc" | "desc";
}

export type ApplicationListResponse = PaginatedResponse<ApplicationSummary>;

export interface OriginationKpis {
  total: number;
  new: number;
  incomplete: number;
  submitted: number;
  pending_documents: number;
  additional_info_required: number;
  under_assessment: number;
  pending_approval: number;
  approved: number;
  rejected: number;
  withdrawn: number;
  converted: number;
  expired: number;
  amount_requested: MoneyString;
  /** Null without `loans:view`. */
  amount_approved: MoneyString | null;
  /** Hours from submission to decision, one decimal. */
  avg_processing_hours: number | null;
  /** Percent, one decimal. */
  completion_rate: number | null;
  approval_rate: number | null;
}

export interface OriginationDashboard {
  period: { from: string; to: string };
  /** The period of the same length just before, which `previous` covers. */
  previous_period: { from: string; to: string };
  kpis: OriginationKpis;
  previous: OriginationKpis;
  trends: { date: string; completed: number; incomplete: number }[];
  by_status: { status: ApplicationStatus; label: string; count: number }[];
  by_product: { product_id: number | null; product: string; count: number }[];
  decisions: { date: string; approved: number; rejected: number }[];
  /** Average hours spent in each stage left during the period. */
  stage_times: { status: ApplicationStatus; label: string; avg_hours: number; stays: number }[];
  /** The executive dashboard's turnaround on the loans the applications became; null without `loans:view`. */
  turnaround: OriginationTurnaround | null;
  recent: ApplicationSummary[];
}

/** `ApplicationTurnaround::build()`, as the executive dashboard reads it. */
export type OriginationTurnaround = Record<
  "submitted_to_approved" | "approved_to_released" | "submitted_to_released",
  TurnaroundStretch
>;

/** `OriginationLinkResource`. */
export interface ApplicationLink {
  id: number;
  name: string;
  token: string;
  /** Null while the server's public address isn't set up. */
  url: string | null;
  active: boolean;
  status: "active" | "disabled" | "expired";
  status_label: string;
  /** Test links stay out of the dashboard, and only they show staging test codes. */
  is_test: boolean;
  branch_id: number | null;
  branch_name: string | null;
  loan_product_ids: number[];
  loan_product_names: string[];
  expires_at: string | null;
  display_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  visits: number;
  started: number;
  submitted: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface ApplicationLinkInput {
  name: string;
  active: boolean;
  is_test: boolean;
  branch_id: number | null;
  loan_product_ids: number[];
  expires_at: string | null;
  display_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
}

/** The sections `PUT /loan-origination/settings` takes. */
export interface OriginationSettingsInput {
  general: {
    online_applications_enabled: boolean;
    /** Release a loan only once its member's registration is approved. On by default. */
    require_approved_member: boolean;
    default_branch_id: number | null;
    /** 2 to 5 capital letters, then -YYYY-NNNNNN. */
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

/** `GET /loan-origination/settings`: the editable sections and what the server reports. */
export interface OriginationSettings extends OriginationSettingsInput {
  rules_version: number;
  server: {
    /** LOAN_ORIGINATION_ENABLED. */
    enabled: boolean;
    /** The address links are built on; null with `public_url_problem` in words. */
    public_url: string | null;
    public_url_problem: string | null;
    pdf_check: string;
    scanner: string;
  };
  updated_by: StaffRef | null;
  updated_at: string | null;
}
