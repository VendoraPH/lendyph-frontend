/**
 * The public loan application's contract, as LO-B2 merged it: the
 * `/api/public-apply/{token}` routes (`PublicApplyController`), the landing
 * page (`PublicPortal::present()`), the applicant's own state and tracking
 * (`PublicApplicationPresenter`) and the estimate (`PublicEstimate`).
 *
 * The applicant has no Lendy account: a link token, then after the code step
 * an `X-Application-Session` header. Every figure is the server's; money comes
 * as the server sends it (a number or a two-decimal string) and is only shown.
 * The draft's own shape is shared with the staff screens.
 */

import type { ApplicationDraft, DocumentStatus } from "./loan-origination";

/** A text the applicant accepts, by version; `final` once it is the owner's wording. */
export interface PublicNotice {
  version: string;
  text: string;
  final: boolean;
}

/** The notices an applicant can be asked to accept (`OriginationNotice::TYPES`). */
export type NoticeKey = "privacy_notice" | "terms" | "declaration" | "credit_authorization";

/** A loan product as a public link offers it. A product's limits may be unset. */
export interface PublicProduct {
  id: number;
  name: string;
  description: string | null;
  min_amount: number | null;
  max_amount: number | null;
  min_term: number | null;
  max_term: number | null;
  term_unit: "months" | "days";
  payment_frequencies: string[];
  interest_method: string | null;
  interest_rate: number;
  interest_rate_frequency: string | null;
  eligibility: string | null;
  instructions: string | null;
}

/** A document type the settings list, for the landing page. */
export interface PublicDocumentType {
  type: string;
  label: string;
  description: string | null;
  required: boolean;
}

/** `GET /public-apply/{token}`: the landing page. */
export interface PublicPortal {
  organization: {
    name: string;
    logo_url: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    address: string | null;
  };
  /** False when the link takes no application now; `closed_reason` says why, in words. */
  accepting: boolean;
  closed_reason: string | null;
  welcome_heading: string;
  intro: string | null;
  eligibility: string | null;
  estimated_minutes: number | null;
  /** Null until a version is published (the link reads closed until then). */
  privacy_notice: PublicNotice | null;
  terms: PublicNotice | null;
  credit_authorization: PublicNotice | null;
  declaration: PublicNotice | null;
  products: PublicProduct[];
  documents: PublicDocumentType[];
  branches: { id: number; name: string }[];
  /** Already limited by the server to JPEG, PNG and PDF names. */
  accepted_file_types: string[];
  max_upload_mb: number;
  /** Channels a code can reach the applicant by; empty means nobody gets past the code step. */
  otp_channels: string[];
}

/** Why a code is asked for: a new application, resuming a draft, or tracking one. */
export type OtpPurpose = "apply" | "resume" | "track";

/** Who the code is for. Codes go by text message only. */
export interface OtpTarget {
  mobile: string;
  purpose: OtpPurpose;
  /** Tracking also names the application. */
  reference_number?: string;
}

/** `POST …/otp`: what happened to the code. */
export interface CodeSent {
  resend_after: number;
  expires_in: number;
  channel: string;
  /** Masked by the server (`63917*****67`). */
  destination: string;
  /** True only when a provider sent the text. */
  delivered: boolean;
  /** Staging's test-code mode: the code on screen, never sent. */
  test_mode?: { code: string; notice: string };
}

/** One document on the applicant's side: every listed type, uploaded or not. */
export interface PublicDocument {
  /** The document's random public id; null until a file is uploaded. */
  id: string | null;
  type: string;
  label: string;
  required: boolean;
  status: DocumentStatus;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string | null;
}

/** One declared line, converted to a month by the server. */
export interface DeclaredLine {
  key: string;
  label: string;
  monthly: string;
}

/** The declared amounts the server added up (`DraftRules::declaredTotals()`). */
export interface DeclaredTotals {
  monthly_income: string | null;
  monthly_expenses: string;
  monthly_debt_payments: string;
  monthly_remaining: string | null;
  income: DeclaredLine[];
  expenses: DeclaredLine[];
  debts: DeclaredLine[];
}

/** The applicant's own application, as the server works it out. */
export interface PublicApplicationState {
  reference_number: string | null;
  status: string;
  /** Worked out by the server; the browser never sends it. */
  last_completed_step: string | null;
  completion_percent: number;
  draft: ApplicationDraft;
  documents: PublicDocument[];
  verified_contact: { mobile: string | null; email: string | null };
  declared_totals: DeclaredTotals;
  /** What still blocks a submit: `draft.<section>.<field>` => what to do, in words. */
  missing_fields: Record<string, string>;
  /**
   * The chosen product's required fields, filled or not, keyed as
   * `missing_fields` is (`draft.employment.employer_name`); [] with no product
   * or none required (LO-B5, backend #361). Absent from an older API.
   */
  required_fields?: string[];
}

/** `POST …/otp/verify`: the session, and the application unless it is a tracking session. */
export interface ApplicantSession {
  session_token: string;
  expires_at: string;
  idle_minutes: number;
  application: PublicApplicationState | null;
}

/** `POST …/estimate`: the amount as typed (pesos, at most two decimals). */
export interface EstimateRequest {
  loan_product_id: number;
  amount: string;
  term: number;
  frequency: string | null;
}

type Money = number | string;

/** The loan form's own preview. `total_repayment` is principal plus interest. */
export interface PublicEstimate {
  installment: Money;
  installments_count: number;
  frequency: string;
  total_interest: Money;
  total_charges: Money;
  total_repayment: Money;
  net_proceeds: Money | null;
  charges: { name: string; amount: Money }[];
  schedule: { number: number; due_date: string; principal: Money; interest: Money; amount: Money }[];
  assumptions: string[];
}

/** The versions accepted at submit, and the optional marketing consent. */
export interface Consents {
  privacy_notice_version: string;
  terms_version: string;
  declaration_version: string;
  credit_authorization_version: string | null;
  marketing_opt_in: boolean;
}

/** `POST …/submit`: a repeat answers the same reference. */
export interface Submitted {
  reference_number: string;
  submitted_at: string | null;
}

/** What an applicant is told about a submitted application. */
export type TrackingStatus =
  | "draft"
  | "received"
  | "under_review"
  | "additional_info_required"
  | "approved"
  | "not_approved"
  | "withdrawn"
  | "expired";

/** `GET …/track`: a fixed set of fields, never notes or assessments. */
export interface Tracking {
  reference_number: string;
  submitted_at: string | null;
  status: TrackingStatus;
  status_message: string;
  outstanding_requirements: string[];
  requested_actions: string[];
  replaceable_documents: PublicDocument[];
  decision_notice: string | null;
  contact: { phone: string | null; email: string | null };
}
