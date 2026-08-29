/**
 * Contract for the CSV migration importer.
 *
 * Mirrors what the API actually ships — read off the implementations on
 * `csv-import/w2-upload` (run creation, chunks, assemble) and
 * `csv-import/w2-api` (status, product mapping, error report), not from a
 * design document. Where the two overlap, the upload service is the source of
 * truth: its `runPayload()` builds the per-file block and the status endpoint
 * calls through to it rather than rebuilding it.
 */

/** Server-side lifecycle. `is_closed` on the payload is authoritative — do not
 *  hardcode this list to decide "finished", because a phase was added once
 *  already (`cancelled`) and hardcoding is exactly what broke. */
export type ImportPhase =
  | "uploading"
  | "assembled"
  | "staging"
  | "awaiting_mapping"
  | "importing_customers"
  | "importing_loans"
  | "completed"
  | "failed"
  | "cancelled";

/** The two files, keyed — never a positional array. Both endpoints key by this. */
export type ImportFileKind = "customers" | "loans";

/** Per-row outcome. `matched_existing` is deliberately NOT a kind of `skipped`:
 *  the coop already has 44 self-registered members who will appear in the
 *  migration file, and reporting them as skipped makes an admin conclude their
 *  data did not land when it did. */
export interface ImportCounts {
  total: number;
  /** Staging verdicts. `pending` is a row that has been staged but not yet
   *  processed — so the buckets below only reconcile against `total` once the
   *  run is closed. */
  valid: number;
  invalid: number;
  pending: number;
  imported: number;
  matched_existing: number;
  already_imported: number;
  skipped: number;
  failed: number;
}

export interface ImportFileStatus {
  /** The declared file, echoed back. This is the ONLY description a resuming
   *  admin has of what they originally picked — a File handle cannot survive a
   *  reload, so these three are what `sameFile()` compares against. */
  original_filename: string;
  size_bytes: number;
  sha256: string;
  chunk_size: number;
  total_chunks: number;
  received_chunks: number;
  /** Capped at 500 entries. Never size a UI off this — use the count. */
  missing_chunks: number[];
  /** Always exact, even when the list above is truncated. */
  missing_chunk_count: number;
  missing_chunks_truncated: boolean;
  assembled: boolean;
  counts: ImportCounts;
  staging: {
    delimiter: string | null;
    encoding_note: string | null;
    header_skipped: boolean;
    record_count: number | null;
    column_count: number | null;
  };
}

export interface ImportRunStatus {
  id: number;
  phase: ImportPhase;
  is_closed: boolean;
  branch_id: number;
  as_of_date: string;
  files: Partial<Record<ImportFileKind, ImportFileStatus>>;
  /** Approximate by design — `GET /product-mapping` is authoritative. */
  product_mapping_required: boolean;
  error_report_available: boolean;
  rows_with_errors: number;
  /** Server clock. Never compute staleness from the client's own poll time. */
  seconds_since_last_advance: number | null;
  failure_reason: string | null;
}

export interface LoanProductOption {
  id: number;
  name: string;
  interest_method: string;
  interest_rate: string;
  term: number;
  frequency: string;
  min_amount: string;
  max_amount: string;
}

export interface CsvProductMapping {
  /** The staged string, byte-for-byte. A blank cell is the empty string, and it
   *  is a real cohort that must be offered a mapping like any other. */
  csv_name: string;
  loan_count: number;
  suggested_product_id: number | null;
  /** `exact_name_match` | `no_match` | `ambiguous` — ambiguous yields no
   *  suggestion on purpose, because `loan_products.name` is not unique and
   *  guessing mis-prices a whole cohort. */
  suggestion_reason: string;
}

export interface ProductMappingResponse {
  csv_products: CsvProductMapping[];
  csv_products_truncated: boolean;
  loan_products: LoanProductOption[];
  compatibility: {
    disagreeing_rows: number;
    out_of_bounds: { rows: number; amount_above_max: number; term_above_max: number; rate_above_max: number };
    rows_not_importable: number;
  };
}

export type ImportIssueSeverity = "error" | "warning";

export interface ImportRowIssue {
  /** The uploaded FILENAME, not the kind — the API sends both. */
  file: string;
  file_kind: ImportFileKind;
  /** Physical line as the admin's spreadsheet shows it, header included. */
  row_number: number;
  account_no: string | null;
  loan_no: string | null;
  severity: ImportIssueSeverity;
  category: string;
  field: string | null;
  message: string;
  original_value: string | null;
}

/** `meta.total` counts ROWS; `meta.stats.total_issues` counts ISSUE LINES.
 *  One row can carry several issues, so a single number would be wrong either
 *  way. `meta.stats` is computed on page 1 only — `stats_omitted` is true
 *  afterwards, so cache page 1's summary rather than re-reading it. */
export interface ImportErrorPageMeta {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
  unit: "row";
  stats_omitted?: boolean;
  stats?: {
    total_issues: number;
    by_severity: Record<ImportIssueSeverity, number>;
    by_category: Array<{
      category: string;
      severity: ImportIssueSeverity;
      count: number;
      /** One representative message, not a list — plus how many distinct ones
       *  were collapsed into this group. The reservoir is bounded on purpose:
       *  messages interpolate the offending cell, so keying a map by full text
       *  was a memory-exhaustion bug on a large file. */
      label: string;
      distinct_messages: number;
      distinct_messages_truncated: boolean;
    }>;
  };
}
