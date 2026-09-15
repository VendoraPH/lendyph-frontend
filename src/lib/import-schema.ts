/**
 * Column schemas for the data-migration CSV import.
 *
 * Two files arrive: a 22-column Customer Profile and an 18-column Loans sheet.
 * Both are positional — the client's spec sheet tells users to DELETE the
 * header row before uploading — so a column's meaning is its index and nothing
 * else. That makes three failure modes worth catching before a single row is
 * written:
 *
 *  1. the header row is still there and gets imported as a borrower;
 *  2. the header row is gone and row one gets skipped as a header;
 *  3. the loans file is dropped into the customer slot, or the reverse.
 *
 * Everything here is detection and mapping only. Nothing is coerced, corrected
 * or dropped: a value that does not match a known vocabulary is REPORTED, with
 * the options it failed to match, so the UI can offer a mapping rather than
 * quietly writing a blank.
 */

import {
  CIVIL_STATUS_OPTIONS,
  GENDER_OPTIONS,
  INTEREST_TYPE_OPTIONS,
  PAYMENT_FREQUENCY_OPTIONS,
  SUFFIX_OPTIONS,
} from "@/constants";
import { looksLikeDate } from "./import-date";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportShape = "customer" | "loans";

/**
 * `enum` is a CLOSED vocabulary — the database stores one of a fixed set, so an
 * unmatched value is an error the admin has to map.
 *
 * `open-enum` is free text that happens to have a dropdown in the UI. The
 * option list is an affordance for normalising the common spellings, never a
 * gate: an unmatched value passes through verbatim. Suffix is the one today
 * (`borrowers.suffix` is `varchar(20)`, validated `nullable|string|max:20`),
 * and treating it as closed would have rejected every member whose suffix is
 * merely uncommon.
 */
export type ColumnType = "text" | "number" | "date" | "enum" | "open-enum";

export interface EnumOption {
  readonly value: string;
  readonly label: string;
}

/**
 * The limits of a numeric column — a PRECISION question, not a length one.
 *
 * `decimal(12,2)` does not reject a long string; it rejects too many total
 * digits or more than two places after the point. `1234.567` is a real case (a
 * coop system exporting three decimal places) and no character count catches
 * it. `max` is the *validated* ceiling where the app's rules are tighter than
 * the column itself, which they sometimes are — see Pledge Amt.
 */
export interface NumericLimits {
  /** Largest accepted magnitude. */
  readonly max: number;
  /** Digits permitted after the decimal point. */
  readonly decimalPlaces: number;
}

export interface ImportColumn {
  /**
   * Field name on the normalised row. These name the FILE's fields, not the
   * API's — the upload page maps them onto whatever the import endpoint wants.
   * Keeping them separate means a backend rename does not silently reindex a
   * positional file.
   */
  readonly key: string;
  /** The label exactly as printed in the client's workbook. */
  readonly label: string;
  readonly required: boolean;
  readonly type: ColumnType;
  /** The vocabulary. Required for `enum`; a normalising hint for `open-enum`. */
  readonly options?: readonly EnumOption[];
  /**
   * The column's database width in CHARACTERS. Read from the migrations, never
   * inferred — a column with no confirmed limit carries none, and is checked
   * for nothing, which is the honest outcome.
   */
  readonly maxLength?: number;
  /** What a numeric column can actually store. See `NumericLimits`. */
  readonly numeric?: NumericLimits;
  /**
   * A repair the SERVER performs on this column before storing it. Declared
   * here so the pre-check can predict the outcome instead of judging the raw
   * cell: a value the server will happily fix is a warning, not a failure.
   */
  readonly serverRepair?: "contact-number";
  /** Required only when `field` resolves to `equals`. */
  readonly requiredWhen?: { readonly field: string; readonly equals: string };
}

// ---------------------------------------------------------------------------
// The two column tables — order IS the contract
// ---------------------------------------------------------------------------

/** Spouse details are required only of a married member. */
const IF_MARRIED = { field: "civil_status", equals: "married" } as const;

// Numeric limits, named for the role rather than the column type, so the use
// site reads as the rule it is. All from the migrations and the validation
// rules — see the note on PLEDGE_CEILING for the one asymmetry.
/** `decimal(12,2)` at full column capacity. */
const MONEY = { max: 9999999999.99, decimalPlaces: 2 } as const;
/** `decimal(12,2)` but validated `max:99999999.99` — tighter than the column. */
const INCOME_CEILING = { max: 99999999.99, decimalPlaces: 2 } as const;
/**
 * Validated `max:9999999.99` — an order of magnitude BELOW Monthly Income
 * despite sharing the same `decimal(12,2)` column. That asymmetry is in the
 * existing validation rules and is deliberate, not a typo; do not "fix" it.
 */
const PLEDGE_CEILING = { max: 9999999.99, decimalPlaces: 2 } as const;
/** `decimal(8,4)`. A rate given in basis points overflows this, by design. */
const RATE = { max: 9999.9999, decimalPlaces: 4 } as const;
/** Feeds an `unsignedSmallInteger`. Anything past a few hundred is nonsense. */
const TERM = { max: 65535, decimalPlaces: 0 } as const;

export const CUSTOMER_COLUMNS = [
  { key: "account_no", label: "Account No.", required: true, type: "text", maxLength: 50 },
  { key: "last_name", label: "Last Name", required: true, type: "text", maxLength: 255 },
  { key: "first_name", label: "First Name", required: true, type: "text", maxLength: 255 },
  { key: "middle_name", label: "Middle Name", required: false, type: "text", maxLength: 255 },
  { key: "suffix", label: "Suffix", required: false, type: "open-enum", options: SUFFIX_OPTIONS, maxLength: 20 },
  { key: "birthdate", label: "Birthdate", required: true, type: "date" },
  { key: "gender", label: "Gender", required: true, type: "enum", options: GENDER_OPTIONS },
  { key: "civil_status", label: "Civil Status", required: true, type: "enum", options: CIVIL_STATUS_OPTIONS },
  // 20 is the tight one: two PH mobiles joined by a slash is 23 characters, so
  // a cell holding `0917.../0918...` is reported here rather than truncated.
  { key: "contact_number", label: "Contact Number", required: true, type: "text", maxLength: 20, serverRepair: "contact-number" },
  { key: "email", label: "email", required: true, type: "text", maxLength: 255 },
  { key: "street_address", label: "Street Address", required: false, type: "text", maxLength: 255 },
  { key: "barangay", label: "Barangay", required: true, type: "text", maxLength: 255 },
  { key: "city", label: "City/Municipality", required: true, type: "text", maxLength: 255 },
  { key: "province", label: "Province", required: true, type: "text", maxLength: 255 },
  { key: "employer_or_business", label: "Employer/Business Name", required: false, type: "text", maxLength: 255 },
  { key: "monthly_income", label: "Monthly Income", required: false, type: "number", numeric: INCOME_CEILING },
  { key: "pledge_amount", label: "Pledge Amt(If Applicable)", required: false, type: "number", numeric: PLEDGE_CEILING },
  { key: "spouse_first_name", label: "Spouse FName (If Married)", required: false, type: "text", maxLength: 255, requiredWhen: IF_MARRIED },
  { key: "spouse_middle_name", label: "Spouse MName (If Married)", required: false, type: "text", maxLength: 255 },
  { key: "spouse_last_name", label: "Spouse LName (If Married)", required: false, type: "text", maxLength: 255, requiredWhen: IF_MARRIED },
  { key: "spouse_contact_number", label: "Spouse Contact No (If Married)", required: false, type: "text", maxLength: 20, requiredWhen: IF_MARRIED, serverRepair: "contact-number" },
  { key: "spouse_occupation", label: "Spouse Occupation (If Married)", required: false, type: "text", maxLength: 255 },
] as const satisfies readonly ImportColumn[];

export const LOAN_COLUMNS = [
  { key: "account_no", label: "Account No.", required: true, type: "text", maxLength: 50 },
  { key: "loan_no", label: "Loan No.", required: true, type: "text", maxLength: 50 },
  { key: "loan_amount", label: "Loan Amount", required: true, type: "number", numeric: MONEY },
  { key: "loan_balance", label: "Loan Balance", required: true, type: "number", numeric: MONEY },
  { key: "interest_rate", label: "Interest Rate", required: true, type: "number", numeric: RATE },
  { key: "interest_amount", label: "Interest Amount", required: true, type: "number", numeric: MONEY },
  { key: "interest_balance", label: "Interest Balance", required: true, type: "number", numeric: MONEY },
  // The only 500 in either file, and the field most likely to hold a sentence.
  { key: "purpose", label: "Purpose", required: true, type: "text", maxLength: 500 },
  // No confirmed width for Loan Product — deliberately left unconstrained
  // rather than assumed to be 255. Add it once the migration is checked.
  { key: "loan_product", label: "Loan Product", required: true, type: "text" },
  { key: "term_months", label: "Term in Months", required: true, type: "number", numeric: TERM },
  { key: "payment_frequency", label: "Payment Frequency", required: true, type: "enum", options: PAYMENT_FREQUENCY_OPTIONS },
  { key: "interest_type", label: "Interest Type", required: true, type: "enum", options: INTEREST_TYPE_OPTIONS },
  { key: "date_released", label: "Date Released", required: true, type: "date" },
  { key: "maturity_date", label: "Maturity Date", required: true, type: "date" },
  { key: "processing_fee", label: "Processing Fee", required: false, type: "number", numeric: MONEY },
  { key: "service_fee", label: "Service Fee", required: false, type: "number", numeric: MONEY },
  { key: "other_fee_detail", label: "Other Fee Detail", required: false, type: "text", maxLength: 255 },
  { key: "other_fee_amount", label: "Other Fee Amount", required: false, type: "number", numeric: MONEY },
] as const satisfies readonly ImportColumn[];

export type CustomerField = (typeof CUSTOMER_COLUMNS)[number]["key"];
export type LoanField = (typeof LOAN_COLUMNS)[number]["key"];

export type CustomerRow = Record<CustomerField, string>;
export type LoanRow = Record<LoanField, string>;
export type ImportRow = Record<string, string>;

export function columnsFor(shape: ImportShape): readonly ImportColumn[] {
  return shape === "customer" ? CUSTOMER_COLUMNS : LOAN_COLUMNS;
}

// ---------------------------------------------------------------------------
// Vocabulary matching
// ---------------------------------------------------------------------------

/**
 * Lowercase, alphanumerics only.
 *
 * One key collapses every spelling of the same word: `Bi-Weekly`, `bi_weekly`,
 * `BI WEEKLY` and `biweekly` all become `biweekly`, and `Jr.` matches `Jr`.
 * That is what makes matching against BOTH the stored value and the printed
 * label work without a synonym table for the ordinary cases.
 */
export function vocabKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** A parenthetical qualifier: `(If Married)`, `(If Applicable)`. */
const QUALIFIER = /\([^)]*\)/g;

/**
 * The matching key for a HEADER label, which drops parenthetical qualifiers.
 *
 * Six columns in the workbook are qualified — `Pledge Amt(If Applicable)` and
 * the five `Spouse … (If Married)` — and a cooperative that retypes the sheet
 * writes the plain `Pledge Amt` instead. Both are the same column, so both must
 * key the same, and `vocabKey` alone would not do it: it strips the brackets
 * but keeps the words, leaving `pledgeamtifapplicable` against `pledgeamt`.
 * That is six misses out of 22 — enough on its own to drag a genuine header
 * under the threshold and get it imported as a member.
 *
 * Note the workbook is not consistent about the space before the bracket
 * (`Pledge Amt(If Applicable)` has none, the spouse labels do), which is
 * exactly why this strips the qualifier rather than matching a spacing rule.
 * Kept separate from `vocabKey` so vocabulary matching, where `Straight
 * (Fixed)` carries meaning in its brackets, is left alone.
 */
export function headerKey(label: string): string {
  return vocabKey(String(label ?? "").replace(QUALIFIER, ""));
}

/**
 * Known synonyms, keyed by column then by `vocabKey` of the incoming text.
 *
 * The workbook carries NO Excel data-validation rules and no macros, so its
 * enum lists are documentation the typist could ignore — and did. Every entry
 * below is a spelling that is unambiguous to a human reader; anything requiring
 * a judgement call is deliberately absent and comes back as unknown for the
 * admin to map. Fuzzy matching is not used at all: an edit-distance guess is a
 * guess, and this importer does not make those.
 */
const VOCAB_ALIASES: Record<string, Record<string, string>> = {
  // M/F is near-universal in PH member registers; the Filipino words turn up
  // in hand-maintained sheets often enough to be worth the two lines.
  gender: { m: "male", f: "female", lalaki: "male", babae: "female" },
  // No single-letter aliases here on purpose. `M` in a civil-status column
  // would be "married", but `M` is also a gender, and a file whose columns
  // have shifted by one is exactly the case that must NOT resolve cleanly.
  civil_status: {
    maried: "married",
    marrried: "married",
    seperated: "separated",
    widow: "widowed",
    widower: "widowed",
    divorce: "divorced",
    annulled: "separated",
  },
  // `fixed` is what INTEREST_TYPE.FIXED calls this same thing, and "flat" is
  // the term most PH lenders print on their own forms.
  interest_type: {
    fixed: "straight",
    flat: "straight",
    reducing: "diminishing",
    decreasing: "diminishing",
  },
  // "bullet" and "balloon" are named as synonyms for Upon Maturity by the
  // comment on PAYMENT_FREQUENCY_OPTIONS itself.
  // Normalising only — Suffix is open, so anything not listed still passes
  // through verbatim. `jr`/`JR`/`Jr` already fold onto `Jr.` via vocabKey.
  suffix: {
    junior: "Jr.",
    senior: "Sr.",
    "2nd": "II",
    "3rd": "III",
    "4th": "IV",
    "5th": "V",
  },
  payment_frequency: {
    fortnightly: "bi_weekly",
    twicemonthly: "semi_monthly",
    bullet: "upon_maturity",
    balloon: "upon_maturity",
    lumpsum: "upon_maturity",
    maturity: "upon_maturity",
  },
};

export type EnumResolution =
  | { ok: true; value: string; label: string }
  | { ok: false; raw: string; options: readonly EnumOption[] };

/**
 * Match one cell against a column's vocabulary, trimmed and case-insensitively.
 *
 * A blank resolves to a blank — emptiness is a required-field question, not a
 * vocabulary one, and answering it here would report the same cell twice.
 */
export function resolveEnumValue(
  column: ImportColumn,
  raw: string,
): EnumResolution {
  const trimmed = String(raw ?? "").trim();
  if (!column.options) return { ok: true, value: trimmed, label: trimmed };
  if (!trimmed) return { ok: true, value: "", label: "" };

  const hit = matchOption(trimmed, column.options, VOCAB_ALIASES[column.key]);
  if (hit) return { ok: true, value: hit.value, label: hit.label };
  // An OPEN vocabulary cannot fail. The column is free text in the database and
  // the option list is only a dropdown; rejecting `II` — which the client's own
  // Data Dictionary omits too — would flag real members for having an uncommon
  // suffix. Pass it through exactly as typed. Over-length is a separate
  // question, answered by overLengthFields().
  if (column.type === "open-enum") {
    return { ok: true, value: trimmed, label: trimmed };
  }
  return { ok: false, raw: trimmed, options: column.options };
}

/** The match itself: alias first, then the option's own value or printed label. */
function matchOption(
  trimmed: string,
  options: readonly EnumOption[],
  aliases: Record<string, string> | undefined,
): EnumOption | undefined {
  const key = vocabKey(aliases?.[vocabKey(trimmed)] ?? trimmed);
  return options.find(
    (option) => vocabKey(option.value) === key || vocabKey(option.label) === key,
  );
}

export interface UnknownEnumValue {
  key: string;
  /** The column's printed label, for the error report. */
  label: string;
  /** The text as it appeared in the file. */
  raw: string;
  options: readonly EnumOption[];
}

/**
 * Canonicalise every vocabulary cell in a row.
 *
 * A CLOSED enum that does not match keeps its original text in the returned row
 * AND is listed in `unknown`, for the UI to offer a mapping. Blanking it would
 * be the silent drop this module exists to avoid: the row would import looking
 * complete, with one field simply gone.
 *
 * An OPEN vocabulary never lands in `unknown` — an unrecognised suffix is just
 * a suffix, and it is returned exactly as typed.
 */
export function resolveRowEnums(
  row: ImportRow,
  shape: ImportShape,
): { row: ImportRow; unknown: UnknownEnumValue[] } {
  const resolved: ImportRow = { ...row };
  const unknown: UnknownEnumValue[] = [];
  for (const column of columnsFor(shape)) {
    const isVocabulary = column.type === "enum" || column.type === "open-enum";
    if (!isVocabulary || !column.options) continue;
    const result = resolveEnumValue(column, row[column.key] ?? "");
    if (result.ok) resolved[column.key] = result.value;
    else {
      unknown.push({
        key: column.key,
        label: column.label,
        raw: result.raw,
        options: column.options,
      });
    }
  }
  return { row: resolved, unknown };
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/**
 * Map a positional record onto named fields.
 *
 * Short records fill missing fields with `""` rather than `undefined`, so a
 * truncated row fails the required-field check with a readable "Barangay is
 * blank" instead of crashing three layers up. Extra trailing cells are dropped;
 * the count mismatch is the caller's to report.
 */
export function normaliseRow(record: readonly string[], shape: "customer"): CustomerRow;
export function normaliseRow(record: readonly string[], shape: "loans"): LoanRow;
export function normaliseRow(record: readonly string[], shape: ImportShape): ImportRow;
export function normaliseRow(
  record: readonly string[],
  shape: ImportShape,
): ImportRow {
  const row: ImportRow = {};
  columnsFor(shape).forEach((column, index) => {
    row[column.key] = String(record[index] ?? "").trim();
  });
  return row;
}

/**
 * Which required fields this row leaves blank.
 *
 * The conditional spouse fields are evaluated against the RESOLVED civil
 * status, so `MARRIED`, `married` and `maried` all pull in the same three
 * requirements. Returns column labels, ready to show.
 */
export function missingRequiredFields(
  row: ImportRow,
  shape: ImportShape,
): string[] {
  const columns = columnsFor(shape);
  const missing: string[] = [];
  for (const column of columns) {
    if ((row[column.key] ?? "").trim()) continue;
    if (column.required) {
      missing.push(column.label);
      continue;
    }
    const condition = column.requiredWhen;
    if (!condition) continue;
    const source = columns.find((c) => c.key === condition.field);
    if (!source) continue;
    const resolved = resolveEnumValue(source, row[condition.field] ?? "");
    if (resolved.ok && resolved.value === condition.equals) {
      missing.push(column.label);
    }
  }
  return missing;
}

/** Something the server will refuse, or quietly repair, when this row lands. */
export interface FieldSizeProblem {
  key: string;
  label: string;
  /**
   * `too-long`        more characters than the column holds.
   * `too-large`       past the numeric ceiling.
   * `too-precise`     more decimal places than the column stores.
   * `not-a-number`    a numeric column holding something that is not one.
   * `multiple-values` more than one value in a single-value column. Repaired
   *                   server-side, so a warning rather than a failure.
   */
  reason:
    | "too-long"
    | "too-large"
    | "too-precise"
    | "not-a-number"
    | "multiple-values";
  /**
   * `error`   the server REJECTS the row; it will not import as it stands.
   * `warning` the server REPAIRS the value and imports the row anyway. Show
   *           it, say what will happen to the data, and do not count it as a
   *           failure.
   */
  severity: "error" | "warning";
  /** The cell as it appeared, for the error report. */
  raw: string;
  /** Characters, ceiling, or decimal places — whichever was exceeded. */
  limit: number | null;
  /** For a repaired value: what the server will store. */
  kept?: string;
  /** For a repaired value: what it will discard, in the cell's own words. */
  dropped?: string[];
}

/**
 * Mirror of the server's `ValueNormalizer::contactNumber()`.
 *
 * Splits on `/`, `;` or `,`, keeps the first non-empty part, and reduces it to
 * digits plus a leading `+`. Reproduced here — knowingly duplicating server
 * logic — for one narrow purpose: predicting whether a row will import. Without
 * it the pre-check judges the raw cell and reports `0917.../0918...` as a
 * failure, when the server takes that row happily. If the server's rule
 * changes, this must follow; it is a prediction, never the transformation
 * itself, and nothing here rewrites the value that gets uploaded.
 */
function repairContactNumber(raw: string): { kept: string; dropped: string[] } {
  const parts = raw
    .split(/[/;,]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const [first = "", ...rest] = parts;
  const digits = first.replace(/\D/g, "");
  return {
    kept: first.startsWith("+") ? `+${digits}` : digits,
    dropped: rest,
  };
}

/**
 * The subset that actually blocks a row.
 *
 * Exported so the count on screen is computed once. Filtering by severity at
 * three separate call sites is how a warning ends up inside a failure total,
 * and a failure total that includes repairable rows is the thing that makes an
 * admin hand-fix data the importer would have fixed itself.
 */
export function blockingSizeProblems(
  problems: readonly FieldSizeProblem[],
): FieldSizeProblem[] {
  return problems.filter((problem) => problem.severity === "error");
}

/**
 * Strip the decoration a spreadsheet puts on a number.
 *
 * `₱50,000.00`, `PHP 50,000.00`, `P5,000` and `50 000` all name the same
 * amount. Measuring any of them as raw text answers the wrong question, so
 * every numeric check below runs on the output of this, never on the cell.
 * Exported because the value posted to the API has to be normalised too, and
 * two implementations of this would drift.
 */
export function normaliseNumericValue(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/^(?:php|p)\s*/i, "")
    .replace(/[₱$,\s]/g, "");
}

const NUMBER_SHAPE = /^-?(\d+)(?:\.(\d*))?$/;

/**
 * Everything the database will reject on size, found before a single row ships.
 *
 * This is worth real money on a migration: without it the import 422s on row
 * 3,000 after 2,999 rows have already been written, and the admin has no way to
 * see which cell was too long.
 *
 * Length and precision are genuinely different questions. `decimal(12,2)` does
 * not care how long the string is — it rejects too many total digits, or more
 * than two places after the point. A rate of `3.14159` is 7 characters and
 * still unstorable. Trailing zeros are stripped before counting, because
 * `1234.500` is two decimal places written badly, not three.
 *
 * Blanks are skipped: emptiness is `missingRequiredFields`' question, and
 * answering it here would report the same cell twice. Call this on the RESOLVED
 * row (post-`resolveRowEnums`) so vocabularies are measured at their canonical
 * length.
 *
 * Every problem is classified by what the SERVER will do, not by what the cell
 * looks like. `too-large`, `too-precise` and `not-a-number` are genuine
 * rejections and are errors. A contact cell holding two numbers is repaired
 * server-side — the first is kept — so it is a warning, and reporting it as a
 * failure would be worse than not reporting it at all: it tells the admin their
 * data is broken when it is not, on the one screen whose whole job is to be
 * believed. Use `blockingSizeProblems` for anything that counts.
 */
export function fieldSizeProblems(
  row: ImportRow,
  shape: ImportShape,
): FieldSizeProblem[] {
  const problems: FieldSizeProblem[] = [];
  for (const column of columnsFor(shape)) {
    const raw = (row[column.key] ?? "").trim();
    if (!raw) continue;
    const at = (
      reason: FieldSizeProblem["reason"],
      limit: number | null,
      severity: FieldSizeProblem["severity"] = "error",
      extra: Partial<FieldSizeProblem> = {},
    ) =>
      problems.push({
        key: column.key,
        label: column.label,
        reason,
        severity,
        raw,
        limit,
        ...extra,
      });

    // Judged on what the server will STORE, not on the raw cell. A contact
    // field is normalised before it is measured, so `0917-123-4567` is eleven
    // digits and fits, and two numbers cost only a warning.
    if (column.serverRepair === "contact-number") {
      const { kept, dropped } = repairContactNumber(raw);
      if (dropped.length > 0) {
        at("multiple-values", column.maxLength ?? null, "warning", { kept, dropped });
      }
      if (column.maxLength !== undefined && kept.length > column.maxLength) {
        at("too-long", column.maxLength);
      }
      continue;
    }

    if (column.numeric) {
      const parts = NUMBER_SHAPE.exec(normaliseNumericValue(raw));
      if (!parts) {
        at("not-a-number", null);
        continue;
      }
      const places = (parts[2] ?? "").replace(/0+$/, "").length;
      if (places > column.numeric.decimalPlaces) {
        at("too-precise", column.numeric.decimalPlaces);
      }
      if (Math.abs(Number(normaliseNumericValue(raw))) > column.numeric.max) {
        at("too-large", column.numeric.max);
      }
      continue;
    }

    if (column.maxLength !== undefined && raw.length > column.maxLength) {
      at("too-long", column.maxLength);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Header detection
// ---------------------------------------------------------------------------

/**
 * How much of the label set must be present before a record is called a header.
 *
 * Generous, because a client who renamed two columns still uploaded a header,
 * and the gap it has to straddle is enormous: real headers score at or near 1
 * and real data rows score at or near 0. There is no borderland to tune for.
 */
export const HEADER_MATCH_THRESHOLD = 0.6;

export interface HeaderMismatch {
  index: number;
  expected: string;
  found: string;
}

export interface HeaderDetection {
  /** The record is the workbook's header row — in any column order. */
  isHeader: boolean;
  /** Share of positions holding the label expected THERE. 0-1. */
  positionalScore: number;
  /** Share of expected labels present anywhere in the record. 0-1. */
  labelScore: number;
  /** A header whose labels are present but not in the expected order. */
  reordered: boolean;
  /** Positions that do not hold their expected label, for the UI's override. */
  mismatched: HeaderMismatch[];
}

/**
 * Decide whether a record is the header row.
 *
 * Explicitly NOT "is the first cell numeric": account numbers here are
 * alphanumeric (`2020-0041`, `BC-0007`), so that test calls every real data row
 * a header and drops the first member of the file. The signal is the labels
 * themselves, compared case-, space- and punctuation-insensitively, and with
 * parenthetical qualifiers dropped so the workbook's `Spouse FName (If
 * Married)` and a retyped `Spouse FName` are the same column. Leading spaces —
 * which several cells in the workbook carry — fall out of the same keying.
 *
 * `labelScore` and `positionalScore` are reported separately so a header whose
 * columns have been REORDERED is diagnosable: high label score, low positional
 * score. Silently importing that file would put provinces into the email
 * column, and a positional-only check would have called it "not a header" and
 * imported the labels as a borrower instead.
 */
export function detectHeaderRow(
  record: readonly string[],
  shape: ImportShape,
): HeaderDetection {
  const columns = columnsFor(shape);
  const cells = record.map((cell) => headerKey(String(cell ?? "")));
  const present = new Set(cells.filter(Boolean));

  const mismatched: HeaderMismatch[] = [];
  let positional = 0;
  let labelled = 0;

  columns.forEach((column, index) => {
    const expected = headerKey(column.label);
    if (cells[index] === expected) positional += 1;
    else {
      mismatched.push({
        index,
        expected: column.label,
        found: String(record[index] ?? ""),
      });
    }
    if (present.has(expected)) labelled += 1;
  });

  const positionalScore = positional / columns.length;
  const labelScore = labelled / columns.length;
  const isHeader = labelScore >= HEADER_MATCH_THRESHOLD;
  return {
    isHeader,
    positionalScore,
    labelScore,
    reordered: isHeader && positionalScore < HEADER_MATCH_THRESHOLD,
    mismatched,
  };
}

// ---------------------------------------------------------------------------
// Wrong-slot discrimination
// ---------------------------------------------------------------------------

/** A positional smell test: "cell 9 of a customer row is an email address". */
interface Fingerprint {
  index: number;
  test: (value: string) => boolean;
}

const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** `50,000.00`, `₱50000`, `12.5` — an amount as a spreadsheet writes one. */
const AMOUNT_SHAPE = /^-?[₱P$]?\s*\d[\d,]*(\.\d+)?$/;

/** "Does this cell hold a value from that vocabulary?" — blanks prove nothing. */
function matchesVocabulary(key: string, options: readonly EnumOption[]) {
  const aliases = VOCAB_ALIASES[key];
  return (value: string): boolean => {
    const trimmed = String(value ?? "").trim();
    return trimmed !== "" && matchOption(trimmed, options, aliases) !== undefined;
  };
}

const CUSTOMER_FINGERPRINT: Fingerprint[] = [
  { index: 5, test: looksLikeDate },
  { index: 6, test: matchesVocabulary("gender", GENDER_OPTIONS) },
  { index: 7, test: matchesVocabulary("civil_status", CIVIL_STATUS_OPTIONS) },
  { index: 9, test: (v) => EMAIL_SHAPE.test(String(v ?? "").trim()) },
];

const LOANS_FINGERPRINT: Fingerprint[] = [
  { index: 2, test: (v) => AMOUNT_SHAPE.test(String(v ?? "").trim()) },
  { index: 3, test: (v) => AMOUNT_SHAPE.test(String(v ?? "").trim()) },
  { index: 4, test: (v) => AMOUNT_SHAPE.test(String(v ?? "").trim()) },
  { index: 10, test: matchesVocabulary("payment_frequency", PAYMENT_FREQUENCY_OPTIONS) },
  { index: 11, test: matchesVocabulary("interest_type", INTEREST_TYPE_OPTIONS) },
  { index: 12, test: looksLikeDate },
  { index: 13, test: looksLikeDate },
];

/** Minimum score, and minimum lead over the other shape, before we will name one. */
const SHAPE_MIN_SCORE = 0.5;
const SHAPE_MIN_LEAD = 0.2;

export interface ShapeGuess {
  /** `null` when the record resembles neither file, or both equally. */
  shape: ImportShape | null;
  customerScore: number;
  loansScore: number;
  /** Which evidence decided it: the labels, or the cells' own contents. */
  basis: "header" | "content";
}

function fingerprintScore(
  record: readonly string[],
  fingerprint: Fingerprint[],
  expectedLength: number,
): number {
  const hits = fingerprint.filter((f) => f.test(String(record[f.index] ?? ""))).length;
  // Column count is folded in as one more signal rather than used as a gate:
  // 22 vs 18 is strong evidence, but a file with a stray trailing comma still
  // has to be identifiable.
  const lengthHit = record.length === expectedLength ? 1 : 0;
  return (hits + lengthHit) / (fingerprint.length + 1);
}

/**
 * Which of the two files does this record come from?
 *
 * For catching the user who put the loans CSV in the customer slot — a mistake
 * that is otherwise invisible until the import writes loan amounts into
 * birthdates. A header row is decided on its labels; a headerless row on the
 * shape of its cells, which is unusually reliable here because the two layouts
 * disagree everywhere it counts (an email at index 9 versus a term in months, a
 * date at index 12 versus a city name).
 */
export function identifyShape(record: readonly string[]): ShapeGuess {
  const customerHeader = detectHeaderRow(record, "customer");
  const loansHeader = detectHeaderRow(record, "loans");

  if (customerHeader.isHeader || loansHeader.isHeader) {
    return {
      shape: decide(customerHeader.labelScore, loansHeader.labelScore),
      customerScore: customerHeader.labelScore,
      loansScore: loansHeader.labelScore,
      basis: "header",
    };
  }

  const customerScore = fingerprintScore(record, CUSTOMER_FINGERPRINT, CUSTOMER_COLUMNS.length);
  const loansScore = fingerprintScore(record, LOANS_FINGERPRINT, LOAN_COLUMNS.length);
  return {
    shape: decide(customerScore, loansScore),
    customerScore,
    loansScore,
    basis: "content",
  };
}

function decide(customerScore: number, loansScore: number): ImportShape | null {
  const best = Math.max(customerScore, loansScore);
  if (best < SHAPE_MIN_SCORE) return null;
  if (Math.abs(customerScore - loansScore) < SHAPE_MIN_LEAD) return null;
  return customerScore > loansScore ? "customer" : "loans";
}
