/**
 * CIC reporting (Phase 10): the Credit Submission Data File (CSDF) a lender
 * sends the Credit Information Corporation.
 *
 * The backend is the single source of truth (`routes/api/cic/*.php`). Each
 * month's records are frozen in a month-end capture; files and corrections are
 * built only from a capture, on the server, which validates, zips and
 * encrypts them. The browser receives counts, issues and labels, plus a
 * record's member name and values only when the caller holds
 * `borrowers:view`. It never receives the plain file.
 */

/** A staff member as the CIC endpoints name them. */
export interface CicStaff {
  id: number;
  name: string | null;
}

/** One entry of a CIC code list, as the server sends it. */
export interface CicCode {
  code: string;
  label: string;
}

/** The record types Lendy reports: individuals, installment and non-installment contracts, negative events. */
export type CicDataRecordType = "ID" | "CI" | "CN" | "NE";

/** Contract records; a cooperative grants no credit card (CC). */
export type CicContractRecordType = Extract<CicDataRecordType, "CI" | "CN">;

/** Issues may also sit on the file's header (HD) or footer (FT). */
export type CicIssueRecordType = CicDataRecordType | "HD" | "FT";

export type CicSeverity = "error" | "warning";

/** M mandatory, D dependent, NM not mandatory (CIC's field classification). */
export type CicClassification = "M" | "D" | "NM";

// ── GET /cic/status ──

export interface CicStatusKey {
  fingerprint: string;
  key_id: string;
  algorithm: string | null;
  expires_at: string | null;
  expired: boolean;
}

export interface CicStatusCapture {
  id: number;
  reference_date: string;
  kind: CicCaptureKind;
  status: CicCaptureStatus;
  finished_at: string | null;
}

export interface CicStatus {
  enabled: boolean;
  format_version: string;
  provider_code_set: boolean;
  active_key: CicStatusKey | null;
  /** The latest complete capture. */
  last_capture: CicStatusCapture | null;
  /** Staging only: a test capture dated today can be taken on any day. */
  test_captures: boolean;
}

// ── Settings and keys ──

export interface CicSettings {
  provider_code: string | null;
  /** Fixed at "1.0" (the 2016 CSDF) in v1: shown, never edited. */
  format_version: string;
  is_mfi: boolean;
  institution_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  updated_by: CicStaff | null;
  updated_at: string | null;
}

export type UpdateCicSettingsData = Pick<
  CicSettings,
  "provider_code" | "is_mfi" | "institution_name" | "contact_name" | "contact_email" | "contact_phone"
>;

export type CicKeyStatus = "pending" | "active" | "retired";

/** One of CIC's public keys. Nothing is ever deleted, so the list is the key history. */
export interface CicPublicKey {
  id: number;
  fingerprint: string;
  /** The fingerprint in groups, for reading aloud with CIC. */
  fingerprint_display: string;
  key_id: string;
  algorithm: string | null;
  user_ids: string[];
  key_created_at: string | null;
  expires_at: string | null;
  expired: boolean;
  status: CicKeyStatus;
  uploaded_by: CicStaff | null;
  uploaded_at: string;
  verified_by: CicStaff | null;
  verified_at: string | null;
  retired_by: CicStaff | null;
  retired_at: string | null;
  retire_reason: string | null;
  /** The caller may verify it: a pending key, and someone other than its uploader. */
  can_verify: boolean;
}

// ── Product mappings ──

export interface CicProductMappingValue {
  record_type: CicContractRecordType;
  contract_type: string;
  contract_type_label: string | null;
  transaction_type: string;
  transaction_type_label: string | null;
  purpose_code: string | null;
  purpose_label: string | null;
  updated_by: CicStaff | null;
  updated_at: string | null;
}

export interface CicProductMappingRow {
  loan_product: { id: number; name: string; status: string };
  mapping: CicProductMappingValue | null;
}

export interface CicProductMappingCodeLists {
  "CI:ContractTypeDomain": CicCode[];
  "CN:ContractTypeDomain": CicCode[];
  TransactionTypeDomain: CicCode[];
  CreditPurposeDomain: CicCode[];
}

export interface CicProductMappings {
  products: CicProductMappingRow[];
  code_lists: CicProductMappingCodeLists;
}

export interface SaveCicProductMapping {
  loan_product_id: number;
  record_type: CicContractRecordType;
  contract_type: string;
  transaction_type: string;
  /** CI only: CN has no purpose of credit. */
  purpose_code?: string | null;
}

// ── Per-loan overrides ──

export interface CicLoanOverride {
  id: number;
  loan: { id: number; display_number: string; status: string; loan_product: { id: number; name: string } | null };
  record_type: CicContractRecordType | null;
  contract_type: string | null;
  contract_type_label: string | null;
  transaction_type: string | null;
  transaction_type_label: string | null;
  /** The product mapping the override stands in for, as the server reads it. */
  product_mapping: Partial<CicProductMappingValue> | null;
  reason: string;
  created_by: CicStaff | null;
  created_at: string;
  updated_by: CicStaff | null;
  updated_at: string | null;
}

export interface CicLoanOverrideCodes {
  record_type: CicContractRecordType | null;
  contract_type: string | null;
  transaction_type: string | null;
}

export interface CreateCicLoanOverride extends CicLoanOverrideCodes {
  loan_id: number;
  reason: string;
}

export interface UpdateCicLoanOverride extends CicLoanOverrideCodes {
  reason: string;
}

// ── Code mappings ──

export type CicCodeMappingDomain = "collateral_type" | "id_kind";

export interface CicCodeMappingRow {
  lendy_value: string;
  name: string;
  /** The CIC code list the saved code belongs to. */
  cic_domain: string | null;
  cic_code: string | null;
  cic_label: string | null;
  /** What Lendy suggests. Never saved until sent back explicitly. */
  suggested_domain: string | null;
  suggested_code: string | null;
  suggested_label: string | null;
}

export interface CicIdKindRow extends CicCodeMappingRow {
  /** One of the nine standard ID kinds (else a name staff typed as "others"). */
  standard: boolean;
}

export interface CicCodeMappings {
  collateral_type: CicCodeMappingRow[];
  id_kind: CicIdKindRow[];
  code_lists: {
    GuaranteesDomain: CicCode[];
    IDTypeDomain: CicCode[];
    IdentificationTypeDomain: CicCode[];
  };
}

export interface SaveCicCodeMapping {
  domain: CicCodeMappingDomain;
  lendy_value: string;
  cic_domain: string | null;
  /** Null removes the mapping. */
  cic_code: string | null;
}

// ── Readiness, records and issues ──

export interface CicRecordCounts {
  records: number;
  with_errors: number;
  with_warnings: number;
  ready: number;
  errors: number;
  warnings: number;
}

export interface CicIssue {
  record_type: CicIssueRecordType;
  /** The subject or contract number; empty for a file-level issue. */
  record_key: string;
  field_id: string | null;
  field_name: string | null;
  classification: CicClassification | null;
  severity: CicSeverity;
  /** The server's internal code. Never shown: `code_label` and `message` say it in words. */
  code: string;
  /** The code in words ("Missing required field"), once the server sends it. */
  code_label?: string;
  message: string;
  /** Only with `borrowers:view`. */
  member?: CicMember;
}

export interface CicTopIssue {
  record_type: CicIssueRecordType;
  field_id: string | null;
  field_name: string | null;
  classification: CicClassification | null;
  code: string;
  severity: CicSeverity;
  count: number;
  message: string;
}

export interface CicUnmappedProduct {
  loan_product_id: number;
  name: string;
  contracts: number;
}

/** The live picture, built now on the server. No personal data. */
export interface CicReadiness {
  reference_date: string;
  provider_code_set: boolean;
  /** Any error anywhere: a file can't be generated from this picture. */
  blocking: boolean;
  record_types: Record<CicDataRecordType, CicRecordCounts>;
  totals: CicRecordCounts;
  file_issues: CicIssue[];
  top_issues: CicTopIssue[];
  unmapped_products: CicUnmappedProduct[];
  last_capture: CicCapture | null;
}

export interface CicMember {
  name: string;
  code: string;
}

export interface CicRecordRow {
  record_type: CicDataRecordType;
  record_key: string;
  errors: number;
  warnings: number;
  /** Only with `borrowers:view`. */
  member?: CicMember;
}

export type CicRecordSource = "live" | "capture";

export interface CicListMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  source: CicRecordSource;
  capture_id: number | null;
  reference_date: string;
}

export interface CicPage<T, M = CicListMeta> {
  data: T[];
  meta: M;
}

export type CicIssuesMeta = CicListMeta & { errors: number; warnings: number };

export interface CicRecordField {
  field_id: string;
  name: string;
  type: string;
  classification: CicClassification;
  max_length: number;
  domain: string | null;
  /** Only with `borrowers:view`. A missing value is an empty position in the file. */
  value?: string | null;
}

export interface CicRecordDetail {
  record_type: CicDataRecordType;
  record_key: string;
  source: CicRecordSource;
  capture_id: number | null;
  errors: number;
  warnings: number;
  issues: CicIssue[];
  fields: CicRecordField[];
  member?: CicMember;
}

/** Where a list reads from: built live as of a date, or one capture. */
export type CicSourceFilter = { capture_id: number } | { reference_date: string };

export interface CicRecordFilters {
  record_type: CicDataRecordType;
  page: number;
}

export interface CicIssueFilters {
  severity?: CicSeverity;
  record_type?: CicDataRecordType;
  page: number;
}

// ── Captures ──

export type CicCaptureKind = "month_end" | "test" | "correction";
export type CicCaptureStatus = "capturing" | "complete" | "failed";

export interface CicCapture {
  id: number;
  reference_date: string;
  kind: CicCaptureKind;
  status: CicCaptureStatus;
  corrects_capture_id: number | null;
  subject_count: number;
  contract_count: number;
  event_count: number;
  checksum: string | null;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  /** Null: the month-end schedule took it. */
  created_by: CicStaff | null;
}

export type CreateCicCaptureData = { kind: "test" } | { kind: "correction"; corrects_capture_id: number };

// ── Submissions ──

/** 0 = standard periodic submission, 1 = correction (HD5). */
export type CicSubmissionType = 0 | 1;

export type CicSubmissionStatus = "generated" | "encrypted" | "submitted" | "accepted" | "rejected";

export interface CicSubmissionRow {
  id: number;
  /** The internal reference, "CIC-000012". */
  reference: string;
  submission_type: CicSubmissionType;
  submission_type_label: string;
  status: CicSubmissionStatus;
  status_label: string;
  reference_date: string;
  capture_id: number;
  corrects_submission_id: number | null;
  /** The plain file's name. The plain file itself is never served. */
  filename: string;
  /** `….zip.gpg`, once encrypted. */
  encrypted_filename: string | null;
  record_count: number;
  key_fingerprint: string | null;
  download_count: number;
  generated_at: string;
  generated_by: CicStaff | null;
  encrypted_at: string | null;
  encrypted_by: CicStaff | null;
  submitted_at: string | null;
  submitted_by: CicStaff | null;
  acknowledged_at: string | null;
  acknowledged_by: CicStaff | null;
  acknowledgement_notes: string | null;
  /** CIC's own reference for the file, recorded with its answer. */
  cic_reference_no: string | null;
  /** What the caller may do with the file now, as the server decides it. */
  actions: CicSubmissionActions;
}

export interface CicValidationSummary {
  errors: number;
  warnings: number;
  top_issues: Omit<CicTopIssue, "classification" | "message">[];
}

export interface CicSubmissionKey {
  id: number;
  fingerprint: string;
  key_id: string;
  algorithm: string | null;
  user_ids: string[];
  key_created_at: string | null;
  expires_at: string | null;
  verified_at: string | null;
  expired: boolean;
  /** The server will encrypt with it. */
  usable: boolean;
  /** Why not, in words. */
  unusable_reason: string | null;
}

export interface CicAffectedRecord {
  record_type: CicDataRecordType;
  record_key: string;
  change: "changed" | "added";
}

export interface CicSubmissionLink {
  id: number;
  reference: string;
  filename: string;
  status: CicSubmissionStatus;
  status_label: string;
  generated_at: string;
}

export interface CicSubmissionHistoryEntry {
  status: CicSubmissionStatus;
  status_label: string;
  at: string;
  by: CicStaff | null;
}

/** What the caller may do with the file now, as the server decides it. */
export interface CicSubmissionActions {
  encrypt: boolean;
  download: boolean;
  mark_submitted: boolean;
  acknowledge: boolean;
  correct: boolean;
}

/** The pre-encryption review and the submission's record. No member data. */
export interface CicSubmissionDetail extends CicSubmissionRow {
  provider_code: string | null;
  format_version: string;
  zip_filename: string;
  counts_by_type: Partial<Record<CicDataRecordType, number>>;
  txt_sha256: string;
  zip_sha256: string | null;
  gpg_sha256: string | null;
  comments: string | null;
  capture: { id: number; kind: CicCaptureKind; reference_date: string; finished_at: string | null; checksum: string | null };
  validation: CicValidationSummary;
  active_key: CicSubmissionKey | null;
  encrypted_with: { fingerprint: string; key_id: string | null; user_ids: string[] } | null;
  encryption: {
    method: string;
    archive: string;
    output_extension: string;
    recipient: string;
    gpg_available: boolean;
  };
  correction: {
    reason: string | null;
    corrects: (CicSubmissionLink & { reference_date: string; submitted_at: string | null; record_count: number }) | null;
    affected_count: number;
    affected_records: CicAffectedRecord[];
  } | null;
  corrections: CicSubmissionLink[];
  history: CicSubmissionHistoryEntry[];
}

export interface CicSubmissionFilters {
  status?: CicSubmissionStatus;
  submission_type?: CicSubmissionType;
  page: number;
  per_page: number;
}

export interface GenerateCicSubmissionData {
  capture_id: number;
  submission_type: CicSubmissionType;
  /** Up to 100 characters, no "|" or line break; written in the header. */
  comments?: string;
  /** Sent once the user has read the warnings the server returned. */
  confirm_warnings?: boolean;
  corrects_submission_id?: number;
  correction_reason?: string;
}

export interface CicAcknowledgementData {
  status: Extract<CicSubmissionStatus, "accepted" | "rejected">;
  /** Required for a rejection. */
  notes?: string;
  /** Up to 60 characters; the server checks and folds it. */
  cic_reference_no?: string;
}
