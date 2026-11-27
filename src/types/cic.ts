/**
 * CIC reporting (Phase 10): the Credit Submission Data File (CSDF) a lender
 * sends the Credit Information Corporation. The record layouts and domain
 * codes live in `src/lib/cic/`; these are the shapes the API serves.
 *
 * Contract: docs/CIC_BACKEND_HANDOFF.md. Not built in lendyph-backend yet.
 */
import type { CicIssue, CicRecordType, CicRecordValues, CicSubmissionType } from "@/lib/cic/types";

export type CicContractRecordType = Extract<CicRecordType, "CI" | "CN" | "CC">;
export type CicSubjectRecordType = Extract<CicRecordType, "ID" | "BD">;

/** The armored public key CIC issued, as stored. The private key is CIC's and never reaches Lendy. */
export interface CicPublicKey {
  fingerprint: string;
  /** e.g. "RSA 4096". */
  algorithm: string | null;
  user_id: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  expires_at: string | null;
}

export interface CicSettings {
  /** The 8-character provider code CIC assigned. Null until it is set. */
  provider_code: string | null;
  /** Microfinance institution: CIC requires subdivision for addresses and fewer contact fields. */
  is_mfi: boolean;
  /** Who CIC contacts about a file. */
  contact_name: string | null;
  contact_email: string | null;
  public_key: CicPublicKey | null;
}

export type UpdateCicSettingsData = Pick<
  CicSettings,
  "provider_code" | "is_mfi" | "contact_name" | "contact_email"
>;

/**
 * How one loan product is reported: which contract record and which CIC
 * contract type (`CI:ContractTypeDomain` / `CN:` / `CC:`). A product without
 * a mapping is left out of the file and counted on the readiness screen.
 */
export interface CicProductMapping {
  loan_product_id: number;
  loan_product_name: string;
  record_type: CicContractRecordType | null;
  contract_type: string | null;
  /** CreditPurposeDomain code, when the product has one purpose. */
  purpose: string | null;
}

export type SaveCicProductMapping = Pick<
  CicProductMapping,
  "loan_product_id" | "record_type" | "contract_type" | "purpose"
>;

/** A member or business mapped to its CIC subject record. */
export interface CicSubjectRecord {
  id: number;
  borrower_id: number;
  /** The Provider Subject No (position 5). */
  subject_no: string;
  name: string;
  record_type: CicSubjectRecordType;
  /** Keyed by field id (`ID7`, `BD9`, …), as the backend mapped them. */
  values: CicRecordValues;
  updated_at: string | null;
}

/** A loan mapped to its CIC contract record. */
export interface CicContractRecord {
  id: number;
  loan_id: number;
  loan_number: string | null;
  subject_no: string;
  borrower_name: string;
  record_type: CicContractRecordType;
  /** ContractPhaseDomain code: RQ, RN, RF, AC, CL, CA. */
  contract_phase: string | null;
  values: CicRecordValues;
  updated_at: string | null;
}

export interface CicRecordFilters {
  reference_date: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface CicReadinessCount {
  total: number;
  /** Records with no validation error. */
  ready: number;
  with_errors: number;
}

/** The readiness figures for one File Reference Date, worked out by the backend. */
export interface CicReadiness {
  reference_date: string;
  subjects: CicReadinessCount;
  contracts: CicReadinessCount;
  /** Loan products with no CIC mapping, whose loans are left out. */
  unmapped_products: number;
  /** Members without a field CIC needs, counted per field. */
  top_issues: { field_id: string; field_name: string; count: number }[];
  last_submission: CicSubmission | null;
}

export type CicSubmissionStatus =
  | "generated"
  | "encrypted"
  | "submitted"
  | "accepted"
  | "rejected";

export interface CicSubmission {
  id: number;
  filename: string;
  file_reference_date: string;
  submission_type: CicSubmissionType;
  status: CicSubmissionStatus;
  record_count: number;
  error_count: number;
  warning_count: number;
  comments: string | null;
  /** The submission this one corrects (submission type 1). */
  corrects_submission_id: number | null;
  /** SHA-256 of the plain file, so a re-download can be checked. */
  checksum: string | null;
  key_fingerprint: string | null;
  created_by: string | null;
  created_at: string;
  submitted_at: string | null;
  acknowledged_at: string | null;
  acknowledgement_notes: string | null;
}

export interface GenerateCicSubmissionData {
  file_reference_date: string;
  submission_type: CicSubmissionType;
  comments?: string;
  corrects_submission_id?: number;
}

export interface CicAcknowledgementData {
  status: Extract<CicSubmissionStatus, "accepted" | "rejected">;
  notes?: string;
}

/** The backend's own validation of a submission, in the frontend engine's issue shape. */
export interface CicSubmissionDetail extends CicSubmission {
  issues: CicIssue[];
}
