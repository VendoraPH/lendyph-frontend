/**
 * CIC reporting (Phase 10): the Credit Submission Data File (CSDF) a lender
 * sends the Credit Information Corporation.
 *
 * The backend is the single source of truth: it maps members and loans to
 * CIC records, validates them, builds, masks, zips and encrypts the file. The
 * browser only ever receives counts, issues and masked labels, never a
 * record's personal data.
 *
 * Contract: docs/CIC_BACKEND_HANDOFF.md. Not built in lendyph-backend yet.
 */

/**
 * CSDF record types, in the order a file lists them: header, subjects
 * (individual, business, subject link), contracts (installment,
 * non-installment), negative events, footer.
 */
export type CicRecordType = "HD" | "ID" | "BD" | "SL" | "CI" | "CN" | "CC" | "NE" | "FT";

/** A cooperative grants no credit card, so a product maps to installment or non-installment. */
export type CicContractRecordType = Extract<CicRecordType, "CI" | "CN">;
export type CicSubjectRecordType = Extract<CicRecordType, "ID" | "BD">;

/** 0 = Standard periodic submission, 1 = Correction / history submission (HD5). */
export type CicSubmissionType = 0 | 1;

/**
 * Where CIC's public key stands. Only `valid` encrypts: an expired key, or
 * one nobody has checked against the fingerprint CIC gave, is refused.
 */
export type CicKeyStatus = "valid" | "unverified" | "expired";

/** The armored public key CIC issued, as stored. The private key is CIC's and never reaches Lendy. */
export interface CicPublicKey {
  id: number;
  fingerprint: string;
  /** e.g. "RSA 4096". */
  algorithm: string | null;
  user_id: string | null;
  status: CicKeyStatus;
  uploaded_at: string;
  uploaded_by: string | null;
  /** When someone confirmed the fingerprint matches the one CIC gave them. */
  verified_at: string | null;
  verified_by: string | null;
  expires_at: string | null;
}

/** A key that was replaced or removed, kept for the audit trail. */
export interface CicPublicKeyHistoryEntry {
  id: number;
  fingerprint: string;
  uploaded_at: string;
  uploaded_by: string | null;
  retired_at: string | null;
  retired_by: string | null;
  /** Why it was replaced or removed. */
  retired_reason: string | null;
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
 * contract type (`CI:ContractTypeDomain` / `CN:`). A product without a
 * mapping is left out of the file and counted on the readiness screen.
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

/**
 * One subject or contract record as the record lists show it: what staff
 * recognise it by and how many problems it has. Its field values stay on the
 * server.
 */
export interface CicRecordSummary {
  id: number;
  /** Subject: the Provider Subject No. Contract: the loan number. */
  number: string;
  /** The member's or business's name, masked by the server ("J*** D***"). */
  label: string;
  record_type: CicSubjectRecordType | CicContractRecordType;
  /** Contract: its ContractPhaseDomain code (RQ, RN, RF, AC, CL, CA). */
  contract_phase: string | null;
  error_count: number;
  warning_count: number;
}

export interface CicRecordFilters {
  reference_date: string;
  search?: string;
  /** Only records with at least one error. */
  with_errors?: boolean;
  page: number;
  per_page: number;
}

export type CicSeverity = "error" | "warning" | "info";

/** One problem the backend found, field by field. */
export interface CicIssue {
  severity: CicSeverity;
  /** Machine code, e.g. `DOMAIN`. */
  code: string;
  /** The code in words, e.g. "Not in CIC's code list". */
  code_label: string;
  message: string;
  record_type: CicRecordType;
  /** The record's number and masked name; null for a file-level issue. */
  record_label: string | null;
  field_id: string | null;
  field_name: string | null;
}

export interface CicIssueFilters {
  /** `problems` = errors and warnings. */
  severity: CicSeverity | "problems" | "all";
  page: number;
  per_page: number;
}

export interface CicIssueCounts {
  errors: number;
  warnings: number;
  infos: number;
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
  /** Every issue in the file as of the date, by severity. */
  issue_counts: CicIssueCounts;
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
  /** The plain file's name, `{provider}_CSDF_{YYYYMMDDhhmmss}.txt`. It is never served. */
  filename: string;
  /** The file staff download, `….zip.gpg`; null until encrypted. */
  encrypted_filename: string | null;
  file_reference_date: string;
  submission_type: CicSubmissionType;
  status: CicSubmissionStatus;
  record_count: number;
  error_count: number;
  warning_count: number;
  comments: string | null;
  /** The submission this one corrects (submission type 1), and why. */
  corrects_submission_id: number | null;
  correction_reason: string | null;
  /** SHA-256 of the plain file, recorded in the snapshot. */
  checksum: string | null;
  /** SHA-256 of the encrypted file, so a download can be checked. */
  encrypted_checksum: string | null;
  key_fingerprint: string | null;
  created_by: string | null;
  created_at: string;
  encrypted_by: string | null;
  encrypted_at: string | null;
  submitted_at: string | null;
  acknowledged_at: string | null;
  acknowledgement_notes: string | null;
}

export interface GenerateCicSubmissionData {
  file_reference_date: string;
  submission_type: CicSubmissionType;
  comments?: string;
  corrects_submission_id?: number;
  /** Required with `corrects_submission_id`. */
  correction_reason?: string;
}

/** The generated file as the reviewer sees it before it is encrypted, masked by the server. */
export interface CicFilePreview {
  /** The header, the first records and the footer, personal data masked. */
  lines: string[];
  line_count: number;
  byte_size: number;
  /** Records per type, e.g. `{ID: 120, CI: 150}`. */
  record_counts: Partial<Record<CicRecordType, number>>;
}

/** The reviewer's confirmation, sent with the encrypt request. */
export interface EncryptCicSubmissionData {
  confirmed: true;
  /** The key the reviewer saw; the server refuses if the stored key differs. */
  key_fingerprint: string;
}

export interface CicAcknowledgementData {
  status: Extract<CicSubmissionStatus, "accepted" | "rejected">;
  notes?: string;
}
