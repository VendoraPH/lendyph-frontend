/**
 * Column schemas for the data-migration CSV import.
 *
 * Up to three files arrive: a 26-column Customer Profile, an 18-column Loans
 * sheet and a 6-column Share Capital file (finish run round 2, decision 13).
 * The Customer Profile is the client's 22 workbook columns with the four
 * Member Profile fields the workbook lacked appended after them, and a file in
 * the workbook's own 22-column layout still reads (see `acceptedWidths`).
 * All are positional — the client's spec sheet tells users to DELETE the
 * header row before uploading — so a column's meaning is its index and nothing
 * else. That makes three failure modes worth catching before a single row is
 * written:
 *
 *  1. the header row is still there and gets imported as a borrower;
 *  2. the header row is gone and row one gets skipped as a header;
 *  3. one file is dropped into another's slot.
 *
 * Everything here is detection and mapping only. Nothing is coerced, corrected
 * or dropped: a value that does not match a known vocabulary is REPORTED, with
 * the options it failed to match, so the UI can offer a mapping rather than
 * quietly writing a blank.
 */

import {
  CIVIL_STATUS_OPTIONS,
  GENDER_OPTIONS,
  INTEREST_METHOD_LABELS,
  MEMBER_TYPE_OPTIONS,
  PAYMENT_FREQUENCY_OPTIONS,
  SUFFIX_OPTIONS,
} from "@/constants";
import { looksLikeDate } from "./import-date";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportShape = "customer" | "loans" | "share_capital";

/**
 * `enum` is a CLOSED vocabulary — the database stores one of a fixed set, so an
 * unmatched value is reported: an error the admin has to map, or a warning
 * where the server imports it blank (`refusedWhenUnrecognised`).
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
  /**
   * The workbook's own colour coding: blue required, yellow optional. The Data
   * Template paints from it (`@/lib/data-template`). What the import does with
   * a blank is `refusedWhenBlank`, which this never decides.
   */
  readonly required: boolean;
  /**
   * Whether the SERVER refuses a row that leaves this cell blank. Absent, it
   * is `required`, as the share capital file holds it.
   *
   * Set where the two differ. The server refuses a member row only when
   * Account No., Last Name or First Name is blank (`CustomerRowNormalizer`),
   * and imports the workbook's other required cells blank, for staff to
   * complete on the member's page. It imports a loan with a blank Purpose or
   * Loan Product (`LoanRowNormalizer`). The pre-check follows the server: a
   * blank here is an error, and a blank in any other required cell, or in a
   * married member's spouse cell, is a warning.
   */
  readonly refusedWhenBlank?: boolean;
  /**
   * What the import does with this cell left blank, in words, where it takes
   * the row anyway (`refusedWhenBlank: false`). Absent, the members file's:
   * the member is imported without it, to complete on their page.
   */
  readonly whenBlank?: string;
  /**
   * For a closed vocabulary, whether the SERVER refuses a row whose value it
   * doesn't recognise. Absent, it does (Member Type, Payment Frequency,
   * Interest Type, Transaction Type). `false`: it imports the row with the
   * field blank, with a warning (`enum_unmapped`), as for a member's Gender
   * and Civil Status.
   */
  readonly refusedWhenUnrecognised?: boolean;
  readonly type: ColumnType;
  /** The vocabulary. Required for `enum`; a normalising hint for `open-enum`. */
  readonly options?: readonly EnumOption[];
  /**
   * Every spelling the SERVER reads in this column, keyed as it keys a cell
   * (`serverLabelKey`), and the value it stores. When set, it is the whole
   * vocabulary: a cell is one of these or unrecognised, and neither the
   * options' own words nor `VOCAB_ALIASES` match. `options` still names the
   * values in a message.
   */
  readonly serverVocabulary?: Readonly<Record<string, string>>;
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
   *
   * `member-number` is the membership number, stored the way members sign in
   * with it: capitals, with its spaces removed (`canonicalMemberNumber`).
   */
  readonly serverRepair?: "contact-number" | "member-number";
  /** Required only when `field` resolves to `equals`. */
  readonly requiredWhen?: { readonly field: string; readonly equals: string };
  /**
   * What the app stores when the cell is blank or the column is absent, in
   * words: the column's own default (Member Type: Regular). Absent, a blank
   * stays blank.
   */
  readonly defaultWhenBlank?: string;
}

// ---------------------------------------------------------------------------
// The two column tables — order IS the contract
// ---------------------------------------------------------------------------

/** Spouse details are required only of a married member. */
const IF_MARRIED = { field: "civil_status", equals: "married" } as const;

/**
 * Every spelling the server reads for a member's Gender and Civil Status, and
 * the value each stores: `CustomerRowNormalizer::GENDER_MAP` and
 * `::CIVIL_STATUS_MAP`, copied. Anything else is imported blank (finish run
 * round 3), so the members import reads these and no others. Gender reads the
 * Filipino Lalaki (or Lalake) and Babae too (finish run round 4). The member
 * form and the Data Template keep the app's own lists (`GENDER_OPTIONS`,
 * `CIVIL_STATUS_OPTIONS`).
 */
const MEMBER_GENDER_WORDS = {
  male: "male",
  m: "male",
  lalaki: "male",
  lalake: "male",
  female: "female",
  f: "female",
  babae: "female",
} as const;
const MEMBER_CIVIL_STATUS_WORDS = {
  single: "single",
  married: "married",
  widowed: "widowed",
  widow: "widowed",
  widower: "widowed",
  separated: "separated",
  "legally separated": "separated",
  divorced: "divorced",
} as const;

/**
 * Every spelling the server reads for a loan's Payment Frequency and Interest
 * Type, and the value each stores: `LoanRowNormalizer::frequencyMap()`, which
 * keys each `LoanFrequency` with its words spaced and run together, and
 * `::INTEREST_TYPE_MAP`, copied. The server refuses a row with any other
 * (finish run round 4), so the loans import reads these and no others.
 */
const LOAN_FREQUENCY_WORDS = {
  daily: "daily",
  weekly: "weekly",
  "bi weekly": "bi_weekly",
  biweekly: "bi_weekly",
  "semi monthly": "semi_monthly",
  semimonthly: "semi_monthly",
  monthly: "monthly",
  "upon maturity": "upon_maturity",
  uponmaturity: "upon_maturity",
} as const;
const LOAN_INTEREST_TYPE_WORDS = {
  "straight fixed": "straight",
  straight: "straight",
  fixed: "straight",
  flat: "straight",
  diminishing: "diminishing",
  "diminishing balance": "diminishing",
  "upon maturity": "upon_maturity",
} as const;

/**
 * The interest types a loans file carries, in words: the app's two
 * (`INTEREST_TYPE_OPTIONS`) and Upon Maturity, which the server imports too.
 * The Data Template's Interest Type list reads these.
 */
export const LOAN_INTEREST_TYPE_OPTIONS: readonly EnumOption[] = Object.entries(INTEREST_METHOD_LABELS).map(
  ([value, label]) => ({ value, label }),
);

/**
 * What the loans import does with a blank Purpose or Loan Product: it takes
 * the loan (`LoanRowNormalizer`), and a blank product is one of the products
 * the Processing step maps.
 */
const PURPOSE_WHEN_BLANK = "The loan will be imported with no purpose.";
const LOAN_PRODUCT_WHEN_BLANK =
  "The loan will still import: on the Processing step, choose a product for the loans with no product named.";

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

// `required` is the workbook's blue; `refusedWhenBlank` is what the server
// does with a blank (finish run round 3). Only the three names refuse a row.
export const CUSTOMER_COLUMNS = [
  { key: "account_no", label: "Account No.", required: true, refusedWhenBlank: true, type: "text", maxLength: 50 },
  { key: "last_name", label: "Last Name", required: true, refusedWhenBlank: true, type: "text", maxLength: 255 },
  { key: "first_name", label: "First Name", required: true, refusedWhenBlank: true, type: "text", maxLength: 255 },
  { key: "middle_name", label: "Middle Name", required: false, type: "text", maxLength: 255 },
  { key: "suffix", label: "Suffix", required: false, type: "open-enum", options: SUFFIX_OPTIONS, maxLength: 20 },
  { key: "birthdate", label: "Birthdate", required: true, refusedWhenBlank: false, type: "date" },
  { key: "gender", label: "Gender", required: true, refusedWhenBlank: false, refusedWhenUnrecognised: false, type: "enum", options: GENDER_OPTIONS, serverVocabulary: MEMBER_GENDER_WORDS },
  { key: "civil_status", label: "Civil Status", required: true, refusedWhenBlank: false, refusedWhenUnrecognised: false, type: "enum", options: CIVIL_STATUS_OPTIONS, serverVocabulary: MEMBER_CIVIL_STATUS_WORDS },
  // 20 is the tight one: two PH mobiles joined by a slash is 23 characters, so
  // a cell holding `0917.../0918...` is reported here rather than truncated.
  { key: "contact_number", label: "Contact Number", required: true, refusedWhenBlank: false, type: "text", maxLength: 20, serverRepair: "contact-number" },
  { key: "email", label: "email", required: true, refusedWhenBlank: false, type: "text", maxLength: 255 },
  { key: "street_address", label: "Street Address", required: false, type: "text", maxLength: 255 },
  { key: "barangay", label: "Barangay", required: true, refusedWhenBlank: false, type: "text", maxLength: 255 },
  { key: "city", label: "City/Municipality", required: true, refusedWhenBlank: false, type: "text", maxLength: 255 },
  { key: "province", label: "Province", required: true, refusedWhenBlank: false, type: "text", maxLength: 255 },
  { key: "employer_or_business", label: "Employer/Business Name", required: false, type: "text", maxLength: 255 },
  { key: "monthly_income", label: "Monthly Income", required: false, type: "number", numeric: INCOME_CEILING },
  { key: "pledge_amount", label: "Pledge Amt(If Applicable)", required: false, type: "number", numeric: PLEDGE_CEILING },
  { key: "spouse_first_name", label: "Spouse FName (If Married)", required: false, type: "text", maxLength: 255, requiredWhen: IF_MARRIED },
  { key: "spouse_middle_name", label: "Spouse MName (If Married)", required: false, type: "text", maxLength: 255 },
  { key: "spouse_last_name", label: "Spouse LName (If Married)", required: false, type: "text", maxLength: 255, requiredWhen: IF_MARRIED },
  { key: "spouse_contact_number", label: "Spouse Contact No (If Married)", required: false, type: "text", maxLength: 20, requiredWhen: IF_MARRIED, serverRepair: "contact-number" },
  { key: "spouse_occupation", label: "Spouse Occupation (If Married)", required: false, type: "text", maxLength: 255 },
  // Appended after the workbook's 22, never inserted among them (see
  // APPENDED_FROM). Date Hired is on the registration form's Employment step;
  // the other three are the CDA membership columns. All optional: blank is
  // "not set", exactly as in a file made before them.
  { key: "date_hired", label: "Date Hired", required: false, type: "date" },
  { key: "membership_date", label: "Membership Date", required: false, type: "date" },
  { key: "member_type", label: "Member Type", required: false, type: "enum", options: MEMBER_TYPE_OPTIONS, defaultWhenBlank: "Regular" },
  { key: "membership_number", label: "Membership Number", required: false, type: "text", maxLength: 30, serverRepair: "member-number" },
] as const satisfies readonly ImportColumn[];

// The server's rules (`LoanRowNormalizer`, finish run round 4). A blank Purpose
// or Loan Product imports (`refusedWhenBlank`). The amounts, Interest Rate and
// Term in Months carry no limits here: `./import-loan-fields` reads them as the
// server does, with the checks between cells, and says what the server cuts
// (Purpose past 500, Loan Product and Other Fee Detail past 255).
export const LOAN_COLUMNS = [
  // The two identifiers are refused past their 50-character columns, never cut
  // short: an account number tells one member from another, a loan number one
  // loan from another.
  { key: "account_no", label: "Account No.", required: true, type: "text", maxLength: 50 },
  { key: "loan_no", label: "Loan No.", required: true, type: "text", maxLength: 50 },
  { key: "loan_amount", label: "Loan Amount", required: true, type: "number" },
  { key: "loan_balance", label: "Loan Balance", required: true, type: "number" },
  { key: "interest_rate", label: "Interest Rate", required: true, type: "number" },
  { key: "interest_amount", label: "Interest Amount", required: true, type: "number" },
  { key: "interest_balance", label: "Interest Balance", required: true, type: "number" },
  { key: "purpose", label: "Purpose", required: true, refusedWhenBlank: false, whenBlank: PURPOSE_WHEN_BLANK, type: "text" },
  { key: "loan_product", label: "Loan Product", required: true, refusedWhenBlank: false, whenBlank: LOAN_PRODUCT_WHEN_BLANK, type: "text" },
  { key: "term_months", label: "Term in Months", required: true, type: "number" },
  { key: "payment_frequency", label: "Payment Frequency", required: true, type: "enum", options: PAYMENT_FREQUENCY_OPTIONS, serverVocabulary: LOAN_FREQUENCY_WORDS },
  { key: "interest_type", label: "Interest Type", required: true, type: "enum", options: LOAN_INTEREST_TYPE_OPTIONS, serverVocabulary: LOAN_INTEREST_TYPE_WORDS },
  { key: "date_released", label: "Date Released", required: true, type: "date" },
  { key: "maturity_date", label: "Maturity Date", required: true, type: "date" },
  { key: "processing_fee", label: "Processing Fee", required: false, type: "number" },
  { key: "service_fee", label: "Service Fee", required: false, type: "number" },
  { key: "other_fee_detail", label: "Other Fee Detail", required: false, type: "text" },
  { key: "other_fee_amount", label: "Other Fee Amount", required: false, type: "number" },
] as const satisfies readonly ImportColumn[];

/**
 * The share capital file's two kinds of entry, in words, and the side of the
 * ledger each is stored on (`ShareCapitalRowNormalizer::TYPES`). Credit,
 * Debit, CR and DR read too (`VOCAB_ALIASES`).
 */
export const TRANSACTION_TYPE_OPTIONS: readonly EnumOption[] = [
  { value: "credit", label: "Contribution" },
  { value: "debit", label: "Withdrawal" },
];

/**
 * The share capital file, in the server's order (`CsvImportSchema`). Its own
 * template, so the labels are the app's words rather than a workbook's.
 *
 * Transaction Date is written year-month-day only (2026-11-24), as the server
 * reads it, so it is checked as written (`shareCapitalFieldProblems`) rather
 * than settled to a day or month order: a slash date or a spreadsheet date
 * number is refused, never read. Remarks has no length here because the
 * server shortens it with a warning, which the same check says.
 */
export const SHARE_CAPITAL_COLUMNS = [
  { key: "account_no", label: "Account No. or Member ID", required: true, type: "text", maxLength: 50 },
  { key: "transaction_date", label: "Transaction Date", required: true, type: "text" },
  { key: "reference_number", label: "Reference Number", required: false, type: "text", maxLength: 100 },
  { key: "transaction_type", label: "Transaction Type", required: true, type: "enum", options: TRANSACTION_TYPE_OPTIONS },
  { key: "amount", label: "Amount", required: true, type: "number", numeric: MONEY },
  { key: "remarks", label: "Remarks", required: false, type: "text" },
] as const satisfies readonly ImportColumn[];

export type CustomerField = (typeof CUSTOMER_COLUMNS)[number]["key"];
export type LoanField = (typeof LOAN_COLUMNS)[number]["key"];

export type CustomerRow = Record<CustomerField, string>;
export type LoanRow = Record<LoanField, string>;
export type ImportRow = Record<string, string>;

export function columnsFor(shape: ImportShape): readonly ImportColumn[] {
  if (shape === "share_capital") return SHARE_CAPITAL_COLUMNS;
  return shape === "customer" ? CUSTOMER_COLUMNS : LOAN_COLUMNS;
}

// ---------------------------------------------------------------------------
// Layouts: today's, and the workbook's own
// ---------------------------------------------------------------------------

/**
 * The first column appended to a sheet after the client's workbook layout.
 *
 * Columns are only ever APPENDED. The file is read by position, so a column
 * added anywhere else would move every value of an older file one field over.
 * A file made before them is the same file without its last columns, so it
 * still reads, and the appended fields read as blank (not set). The server
 * declares the same (`CsvImportSchema::APPENDED_FROM`).
 */
const APPENDED_FROM: Partial<Record<ImportShape, string>> = { customer: "date_hired" };

/**
 * The record widths a file of this shape may have: today's layout first, then
 * the workbook's earlier one, if the shape has columns appended since.
 */
export function acceptedWidths(shape: ImportShape): readonly number[] {
  const columns = columnsFor(shape);
  const first = APPENDED_FROM[shape];
  const earlier = first ? columns.findIndex((column) => column.key === first) : -1;
  return earlier > 0 ? [columns.length, earlier] : [columns.length];
}

/** The appended columns, which a file in the earlier layout does not have. */
export function appendedColumns(shape: ImportShape): readonly ImportColumn[] {
  const [, earlier] = acceptedWidths(shape);
  return earlier === undefined ? [] : columnsFor(shape).slice(earlier);
}

/**
 * The width a file is held to: its own commonest width when that is one of
 * the shape's layouts, else today's (and the width check then reports it).
 *
 * Every row of the file is held to this ONE width. Accepting either layout row
 * by row would read an old file's row that grew four stray separators as a row
 * of today's layout, with every value after them in the wrong field.
 */
export function layoutWidth(shape: ImportShape, fileWidth: number | undefined): number {
  return fileWidth !== undefined && acceptedWidths(shape).includes(fileWidth)
    ? fileWidth
    : columnsFor(shape).length;
}

/** Whether a width is the shape's earlier layout, not today's. */
export function isEarlierLayout(shape: ImportShape, width: number): boolean {
  return width !== columnsFor(shape).length && acceptedWidths(shape).includes(width);
}

/** `["A", "B", "C"]` → `A, B and C`. */
export function listWords(words: readonly string[]): string {
  return words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/**
 * The widths a shape accepts, in words, for a message: `26, or 22 in the
 * earlier layout without Date Hired, …`, or the one width a single layout has.
 */
export function expectedWidthWords(shape: ImportShape): string {
  const [current, earlier] = acceptedWidths(shape);
  if (earlier === undefined) return String(current);
  return `${current}, or ${earlier} in the earlier layout without ${listWords(appendedColumns(shape).map((column) => column.label))}`;
}

/**
 * What a file in the earlier layout is told about the columns it lacks, and
 * truthfully: a column with a default (Member Type) is not left blank, it
 * reads as that default.
 */
export function earlierLayoutNote(shape: ImportShape, width: number): string | null {
  if (!isEarlierLayout(shape, width)) return null;
  const appended = appendedColumns(shape);
  const blank = appended.filter((column) => column.defaultWhenBlank === undefined).map((column) => column.label);
  const outcomes = [
    ...(blank.length > 0 ? [`with ${listWords(blank)} left blank`] : []),
    ...appended
      .filter((column) => column.defaultWhenBlank !== undefined)
      .map((column) => `${column.label} read as ${column.defaultWhenBlank}, the default`),
  ];
  return `This file is in the earlier ${width}-column layout, without ${listWords(
    appended.map((column) => column.label),
  )}. Its rows import as before, ${outcomes.join(", and ")}.`;
}

/**
 * A membership number as the server stores it: capitals, spaces removed.
 * Mirror of the portal's `MemberNumber::normalise()`, because members sign in
 * with exactly that form. A prediction for the pre-check only; the uploaded
 * file is never rewritten.
 */
export function canonicalMemberNumber(raw: string): string {
  return String(raw ?? "").replace(/\s+/gu, "").toUpperCase();
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
 *
 * A member's Gender and Civil Status, and a loan's Payment Frequency and
 * Interest Type, have none: they read the server's own words and nothing else
 * (`serverVocabulary`), since the server imports any other gender or civil
 * status blank and refuses any other frequency or interest type.
 */
const VOCAB_ALIASES: Record<string, Record<string, string>> = {
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
  // The server's own words (`ShareCapitalRowNormalizer::TYPES`). Credit and
  // Debit already match the options' values.
  transaction_type: {
    cr: "credit",
    sharecapitalcontribution: "credit",
    dr: "debit",
    sharecapitalwithdrawal: "debit",
  },
};

export type EnumResolution =
  | { ok: true; value: string; label: string }
  | { ok: false; raw: string; options: readonly EnumOption[] };

/**
 * Match one cell against a column's vocabulary, trimmed and case-insensitively.
 * A column with a `serverVocabulary` reads exactly the server's words.
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

  const hit = column.serverVocabulary
    ? serverOption(trimmed, column.serverVocabulary, column.options)
    : matchOption(trimmed, column.options, VOCAB_ALIASES[column.key]);
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

/**
 * A cell keyed as the SERVER keys one before a lookup
 * (`CsvImportSchema::normalizeLabel()`): byte-order marks dropped, lower case,
 * each run of characters that are neither letters nor digits one space, then
 * trimmed. Unlike `vocabKey`, a break between words stays: the server reads
 * `Legally-Separated` as `legally separated`, and `LegallySeparated` as
 * nothing it knows.
 */
function serverLabelKey(raw: string): string {
  return raw
    .replace(/\uFEFF/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The server's own lookup: the cell keyed as it keys one, then its words. */
function serverOption(
  trimmed: string,
  words: Readonly<Record<string, string>>,
  options: readonly EnumOption[],
): EnumOption | undefined {
  const key = serverLabelKey(trimmed);
  if (!Object.hasOwn(words, key)) return undefined;
  return options.find((option) => option.value === words[key]);
}

export interface UnknownEnumValue {
  key: string;
  /** The column's printed label, for the error report. */
  label: string;
  /** The text as it appeared in the file. */
  raw: string;
  options: readonly EnumOption[];
  /**
   * `true`: the server refuses the row. `false`: it imports the row with this
   * field blank (`refusedWhenUnrecognised`).
   */
  refused: boolean;
}

/**
 * Canonicalise every vocabulary cell in a row.
 *
 * A CLOSED enum that does not match keeps its original text in the returned row
 * AND is listed in `unknown`, for the UI to offer a mapping. Blanking it would
 * be the silent drop this module exists to avoid: the row would import looking
 * complete, with one field simply gone. Each one says whether the server
 * refuses the row for it or imports the field blank.
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
        refused: column.refusedWhenUnrecognised ?? true,
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

/** A cell the workbook asks for that a row leaves blank. */
export interface MissingField {
  key: string;
  /** The column's printed label, ready to show. */
  label: string;
  /**
   * `true`: the server refuses the row (`refusedWhenBlank`), so it can't be
   * imported. `false`: the server imports it with this field not set.
   */
  refused: boolean;
  /** For a blank the server takes, what becomes of it, when the column says. */
  whenBlank?: string;
}

/**
 * Which required fields this row leaves blank, and whether the server refuses
 * the row for each.
 *
 * The conditional spouse fields are evaluated against the RESOLVED civil
 * status, so `MARRIED`, `married` and `Married.` all pull in the same three
 * requirements.
 */
export function missingRequiredFields(
  row: ImportRow,
  shape: ImportShape,
): MissingField[] {
  const columns = columnsFor(shape);
  const missing: MissingField[] = [];
  const add = (column: ImportColumn) =>
    missing.push({
      key: column.key,
      label: column.label,
      refused: column.refusedWhenBlank ?? column.required,
      ...(column.whenBlank !== undefined && { whenBlank: column.whenBlank }),
    });
  for (const column of columns) {
    if ((row[column.key] ?? "").trim()) continue;
    if (column.required) {
      add(column);
      continue;
    }
    const condition = column.requiredWhen;
    if (!condition) continue;
    const source = columns.find((c) => c.key === condition.field);
    if (!source) continue;
    const resolved = resolveEnumValue(source, row[condition.field] ?? "");
    if (resolved.ok && resolved.value === condition.equals) {
      add(column);
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

    // A membership number is measured as stored, too: `BC 0007` is six
    // characters once its space is gone.
    if (column.serverRepair === "member-number") {
      const kept = canonicalMemberNumber(raw);
      if (column.maxLength !== undefined && kept.length > column.maxLength) {
        at("too-long", column.maxLength, "error", { kept });
      }
      continue;
    }

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
 *
 * It is scored against the columns of the FILE's layout, which is how the
 * server checks it (`CsvImportReader::rejectMismatchedHeader()`): pass the
 * file's width, and the record's own length stands in when there is none. An
 * old file's 22-label header is then a clean header, while the same 22 labels
 * over 26-column rows leave four columns unnamed (`mismatched`, found blank).
 */
export function detectHeaderRow(
  record: readonly string[],
  shape: ImportShape,
  fileWidth: number = record.length,
): HeaderDetection {
  const columns = columnsFor(shape).slice(0, layoutWidth(shape, fileWidth));
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

/**
 * "Does this cell hold a value that column reads?" — blanks prove nothing.
 * Read through the column itself, so a member's gender counts as evidence in
 * exactly the server's words (M and F included).
 */
function matchesVocabulary(shape: ImportShape, key: string) {
  const column = columnsFor(shape).find((c) => c.key === key);
  return (value: string): boolean => {
    const trimmed = String(value ?? "").trim();
    return trimmed !== "" && column !== undefined && resolveEnumValue(column, trimmed).ok;
  };
}

const CUSTOMER_FINGERPRINT: Fingerprint[] = [
  { index: 5, test: looksLikeDate },
  { index: 6, test: matchesVocabulary("customer", "gender") },
  { index: 7, test: matchesVocabulary("customer", "civil_status") },
  { index: 9, test: (v) => EMAIL_SHAPE.test(String(v ?? "").trim()) },
];

/** Date, transaction type and amount, where the share capital file has them. */
const SHARE_CAPITAL_FINGERPRINT: Fingerprint[] = [
  { index: 1, test: looksLikeDate },
  { index: 3, test: matchesVocabulary("share_capital", "transaction_type") },
  { index: 4, test: (v) => AMOUNT_SHAPE.test(String(v ?? "").trim()) },
];

const LOANS_FINGERPRINT: Fingerprint[] = [
  { index: 2, test: (v) => AMOUNT_SHAPE.test(String(v ?? "").trim()) },
  { index: 3, test: (v) => AMOUNT_SHAPE.test(String(v ?? "").trim()) },
  { index: 4, test: (v) => AMOUNT_SHAPE.test(String(v ?? "").trim()) },
  { index: 10, test: matchesVocabulary("loans", "payment_frequency") },
  { index: 11, test: matchesVocabulary("loans", "interest_type") },
  { index: 12, test: looksLikeDate },
  { index: 13, test: looksLikeDate },
];

/** Minimum score, and minimum lead over the next-best shape, before we will name one. */
const SHAPE_MIN_SCORE = 0.5;
const SHAPE_MIN_LEAD = 0.2;

export interface ShapeGuess {
  /** `null` when the record resembles no file, or two of them equally. */
  shape: ImportShape | null;
  customerScore: number;
  loansScore: number;
  shareCapitalScore: number;
  /** Which evidence decided it: the labels, or the cells' own contents. */
  basis: "header" | "content";
}

function fingerprintScore(
  record: readonly string[],
  fingerprint: Fingerprint[],
  widths: readonly number[],
): number {
  const hits = fingerprint.filter((f) => f.test(String(record[f.index] ?? ""))).length;
  // Column count is folded in as one more signal rather than used as a gate:
  // 26 or 22 vs 18 is strong evidence, but a file with a stray trailing comma
  // still has to be identifiable.
  const lengthHit = widths.includes(record.length) ? 1 : 0;
  return (hits + lengthHit) / (fingerprint.length + 1);
}

/**
 * Which of the files does this record come from?
 *
 * For catching the user who put the loans CSV in the customer slot — a mistake
 * that is otherwise invisible until the import writes loan amounts into
 * birthdates. A header row is decided on its labels; a headerless row on the
 * shape of its cells, which is unusually reliable here because the layouts
 * disagree everywhere it counts (an email at index 9 versus a term in months, a
 * date at index 12 versus a city name, and a six-column share capital row with
 * its date, type and amount where neither of the others has them).
 */
export function identifyShape(record: readonly string[]): ShapeGuess {
  const customerHeader = detectHeaderRow(record, "customer");
  const loansHeader = detectHeaderRow(record, "loans");
  const shareCapitalHeader = detectHeaderRow(record, "share_capital");

  if (customerHeader.isHeader || loansHeader.isHeader || shareCapitalHeader.isHeader) {
    const scores = {
      customer: customerHeader.labelScore,
      loans: loansHeader.labelScore,
      share_capital: shareCapitalHeader.labelScore,
    };
    return {
      shape: decide(scores),
      customerScore: scores.customer,
      loansScore: scores.loans,
      shareCapitalScore: scores.share_capital,
      basis: "header",
    };
  }

  const scores = {
    customer: fingerprintScore(record, CUSTOMER_FINGERPRINT, acceptedWidths("customer")),
    loans: fingerprintScore(record, LOANS_FINGERPRINT, acceptedWidths("loans")),
    share_capital: fingerprintScore(record, SHARE_CAPITAL_FINGERPRINT, acceptedWidths("share_capital")),
  };
  return {
    shape: decide(scores),
    customerScore: scores.customer,
    loansScore: scores.loans,
    shareCapitalScore: scores.share_capital,
    basis: "content",
  };
}

/** The best-scoring shape, when it scores enough and leads the next one clearly. */
function decide(scores: Record<ImportShape, number>): ImportShape | null {
  const [best, second] = (Object.entries(scores) as Array<[ImportShape, number]>).sort((a, b) => b[1] - a[1]);
  if (best[1] < SHAPE_MIN_SCORE) return null;
  if (best[1] - (second?.[1] ?? 0) < SHAPE_MIN_LEAD) return null;
  return best[0];
}
