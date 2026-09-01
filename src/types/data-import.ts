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

/**
 * A product to import against, as the mapping endpoint ships it.
 *
 * The numeric fields really are NUMBERS here, not the decimal strings most of
 * this API sends money as — verified against the live response, where
 * `"interest_rate": 10` and `"min_amount": 5000`. Typing them as strings still
 * compiled (`formatRate` accepts both) but it is wrong, and the bounds fields
 * below are compared arithmetically.
 */
export interface LoanProductOption {
  id: number;
  name: string;
  /** Inactive products are still returned — a legacy cohort may legitimately
   *  belong to a product the coop has since retired. */
  status: string;
  interest_method: string;
  interest_rate: number;
  min_interest_rate: number | null;
  frequency: string;
  term: number;
  min_term: number | null;
  max_term: number | null;
  min_amount: number | null;
  max_amount: number | null;
}

/**
 * What the server checked once a CSV name was mapped to a product.
 *
 * Measured against the product a row would ACTUALLY land on — the confirmed
 * mapping when there is one, otherwise the suggestion. So an
 * `exact_name_match` carries a full block before anything is confirmed, which
 * is the point: the admin sees the mismatch while they can still choose
 * differently. It is `null` only when there is neither a confirmed id nor a
 * suggestion (the `no_match` case), or when the distinct-string set hit the
 * cap — a truncated set is never scanned. Null means "not compared", never
 * "compared and fine".
 */
export interface CsvProductCompatibility {
  checked_against_loan_product_id: number;
  checked_against_loan_product_name: string;
  rows: number;
  /** Rows it could actually compare. A row missing a rate or amount is counted
   *  in `rows_unevaluated`, NOT silently as agreeing. */
  rows_evaluated: number;
  rows_unevaluated: number;
  rows_not_importable: number;
  interest_method: {
    product_interest_method: string;
    disagreeing_rows: number;
    /** The methods actually present in the file, with row counts — this is what
     *  lets the screen say WHICH method disagrees instead of only how many. */
    csv_interest_types: Record<string, number>;
  };
  /** Both directions. An earlier draft of this type had only the `above_max`
   *  half, and the live run trips `rate_below_min` — so the screen counted a
   *  row as out of bounds and then had nothing to say about why. */
  out_of_bounds: {
    rows: number;
    amount_below_min: number;
    amount_above_max: number;
    term_below_min: number;
    term_above_max: number;
    rate_below_min: number;
    rate_above_max: number;
  };
}

/**
 * Why the server did or did not suggest a product.
 *
 * The wire values, verbatim — `ambiguous_name`, not `ambiguous`, and
 * `blank_csv_value`, not `blank`. Switching on the wrong spelling compiles
 * fine and silently falls through to whatever the default branch does.
 *
 *  - `exact_name_match` — one product matched, case/whitespace folded.
 *  - `ambiguous_name`   — several matched. NO suggestion is made on purpose:
 *                         `loan_products.name` is not unique, and guessing
 *                         mis-prices an entire cohort. The tied ids arrive in
 *                         `suggestion_candidate_ids` so they can be named.
 *  - `no_match`         — nothing matched. The default on a fresh coop.
 *  - `blank_csv_value`  — the product cell was empty. Still a real cohort:
 *                         `loans.loan_product_id` is NOT NULL, so it blocks
 *                         like any other.
 */
export type ProductSuggestionReason =
  | "exact_name_match"
  | "ambiguous_name"
  | "no_match"
  | "blank_csv_value";

export interface CsvProductMapping {
  /** The staged string, byte-for-byte. A blank cell is the empty string, and it
   *  is a real cohort that must be offered a mapping like any other. */
  csv_value: string;
  /** Authoritative — do not infer the blank cohort from `csv_value === ""`.
   *  A cell of whitespace is blank to the server and not to `===`. */
  is_blank: boolean;
  loan_count: number;
  /** Loans under this name that PASSED staging, and those that did not. A name
   *  whose loans are already failing is a different problem from one that is
   *  merely unmapped, and mapping it will not fix the failures. */
  valid_loan_count: number;
  invalid_loan_count: number;
  /** Whether this entry holds the run up. True only when at least one row
   *  carrying this string staged VALID — a name whose loans all failed staging
   *  cannot be rescued by mapping it, so the server does not demand a choice.
   *  Server-decided; never re-derive it from the counts. */
  blocking: boolean;
  suggested_loan_product_id: number | null;
  /** One of `ProductSuggestionReason`. Note the wire values are
   *  `ambiguous_name` and `blank_csv_value` — NOT `ambiguous`/`blank`. Typed
   *  loosely on purpose: a reason added server-side should reach the admin
   *  rather than fail to compile. */
  suggestion_reason: ProductSuggestionReason | string;
  /** The products that tied, when `ambiguous`. Naming them beats telling the
   *  admin that two products collide and leaving them to work out which two. */
  suggestion_candidate_ids: number[];
  /** The confirmed choice, echoed back. This is what makes a resumed run
   *  render its existing answers instead of an empty form. */
  mapped_loan_product_id: number | null;
  compatibility: CsvProductCompatibility | null;
}

export interface ProductMappingResponse {
  run_id: number;
  phase: ImportPhase;
  /** False before the loans file has been read. There is nothing to map yet —
   *  an empty `csv_products` then means "too early", not "nothing to do". */
  loans_file_staged: boolean;
  /** The gate, server-side. Use this rather than comparing counts client-side,
   *  so the Continue button and the server cannot disagree. */
  mapping_complete: boolean;
  csv_products_truncated: boolean;
  /** The cap that truncation hit, so the message can name it. */
  csv_product_string_cap: number;
  /** The CSV values still needing a choice, as raw strings — BLOCKING entries
   *  only, so it is shorter than "every row without a selection". The blank
   *  cohort appears here as the empty string. This is the server's own answer
   *  to what is outstanding; the client checks it off rather than recomputing
   *  it. A 422 from the PUT returns the same list under `errors.unmapped`. */
  unmapped: string[];
  /** csv value -> loan product id, for what has already been confirmed.
   *  NULL — not `{}` — before anything is confirmed. Verified live: a run at
   *  `awaiting_mapping` sends `"confirmed_mapping": null`, so anything that
   *  reaches into it must guard first. */
  confirmed_mapping: Record<string, number> | null;
  csv_products: CsvProductMapping[];
  loan_products: LoanProductOption[];
  /** Whole-run rollup. Sums the per-entry compatibility blocks, so it is only
   *  non-zero once a mapping has been confirmed. */
  totals: {
    csv_product_strings: number;
    loan_rows: number;
    rows_with_interest_method_disagreement: number;
    rows_outside_product_bounds: number;
    rows_not_compared: number;
  };
}

/** The refreshed payload the PUT hands back, which is the GET payload plus two
 *  fields that only exist in answer to a write. */
export interface ProductMappingConfirmedPayload extends ProductMappingResponse {
  /** Keys sent that the file does not carry. Dropped, not rejected — so a
   *  stale client map does not fail the save, it just does not take effect. */
  ignored_keys?: string[];
  /** A remap after loans were already written under the previous mapping.
   *  Those rows are history and are NOT rewritten, so a non-zero value here is
   *  the difference between "changed" and "changed from here on". */
  loans_already_written_under_previous_mapping?: number;
}

/**
 * What `PUT /imports/{id}/product-mapping` answers.
 *
 * HALF-wrapped, and this is the trap: `message` sits BESIDE `data`, not inside
 * it. `api.put` returns `response.data.data`, so it hands back the refreshed
 * payload and throws the message away — silently, because both are typed
 * `Promise<T>`. Read this with a raw helper and take both halves.
 *
 * The `message` is the server's own statement of what the admin just committed
 * to, compatibility warnings included, counted off the staged rows rather than
 * guessed at on the client. `data` is a full re-read, so a save needs no
 * follow-up GET.
 */
export interface ProductMappingConfirmation {
  message: string;
  data: ProductMappingConfirmedPayload;
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
