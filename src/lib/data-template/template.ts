import {
  CIVIL_STATUS_OPTIONS,
  GENDER_OPTIONS,
  INTEREST_TYPE_OPTIONS,
  MEMBER_TYPE_OPTIONS,
  PAYMENT_FREQUENCY_OPTIONS,
  SUFFIX_OPTIONS,
} from "@/constants";
import {
  CUSTOMER_COLUMNS,
  SHARE_CAPITAL_COLUMNS,
  TRANSACTION_TYPE_OPTIONS,
  type ImportColumn,
} from "@/lib/import-schema";
import type {
  DictionaryKey,
  TemplateColumn,
  TemplateGuideline,
  TemplateSheet,
} from "./types";

/**
 * `public/Lendy CSV Format.xlsm`, transcribed (the Loans sheet; the Members
 * sheet comes from the import's own columns, below).
 *
 * `required` is the workbook's own colour coding — blue (#00B0F0) required,
 * yellow (#FFFF00) optional — read off the header row. If the workbook is ever
 * re-issued, this file is what has to move with it, and the download button
 * still serves the real thing either way.
 */

/**
 * The workbook's Data Dictionary sheet.
 *
 * Derived from `@/constants`, NOT transcribed a second time. The CSV importer
 * (`@/lib/import-schema`) validates uploads against these same option tables,
 * so a hand-typed copy here is a list that silently stops matching the one the
 * importer enforces — it already had: this was written before `II` was added
 * to `SUFFIX_OPTIONS`, and because these columns render as a `<select>`, a
 * member with that suffix could not be entered at all while the importer
 * accepted it perfectly well.
 *
 * The workbook prints labels, not the API's snake_case values, and the labels
 * in those tables are the workbook's own words.
 */
const dictionaryValues = (
  options: readonly { readonly value: string; readonly label: string }[]
): string[] =>
  // `SUFFIX_OPTIONS` leads with a blank-valued "None"; the cell editor renders
  // its own empty choice, so a second one would read as a duplicate.
  options.filter((option) => option.value !== "").map((option) => option.label);

export const DATA_DICTIONARY: Record<
  DictionaryKey,
  { label: string; values: string[] }
> = {
  gender: { label: "Gender", values: dictionaryValues(GENDER_OPTIONS) },
  civil_status: {
    label: "Civil Status",
    values: dictionaryValues(CIVIL_STATUS_OPTIONS),
  },
  suffix: { label: "Suffix", values: dictionaryValues(SUFFIX_OPTIONS) },
  interest_type: {
    label: "Interest Type",
    values: dictionaryValues(INTEREST_TYPE_OPTIONS),
  },
  payment_frequency: {
    label: "Payment Frequency",
    values: dictionaryValues(PAYMENT_FREQUENCY_OPTIONS),
  },
  member_type: {
    label: "Member Type",
    values: dictionaryValues(MEMBER_TYPE_OPTIONS),
  },
  transaction_type: {
    label: "Transaction Type",
    values: dictionaryValues(TRANSACTION_TYPE_OPTIONS),
  },
};

function isDictionaryKey(key: string): key is DictionaryKey {
  return Object.hasOwn(DATA_DICTIONARY, key);
}

const REQUIRED_WHEN_MARRIED = "Required when Civil Status is Married";

/**
 * The Members sheet is the members import's own column table, read from
 * `CUSTOMER_COLUMNS` rather than transcribed, so the template can't drift from
 * what the importer reads: the workbook's 22 columns, then the four it lacked
 * (Date Hired and the membership columns), in the import's order and under the
 * import's labels. A conditional column (the spouse block) is painted required
 * and says when, as the workbook does.
 */
const MEMBER_COLUMNS: TemplateColumn[] = CUSTOMER_COLUMNS.map(
  (column: ImportColumn): TemplateColumn => {
    const conditional = column.requiredWhen !== undefined;
    const dictionary = isDictionaryKey(column.key) ? column.key : undefined;
    const hint =
      column.type === "date"
        ? "YYYY-MM-DD"
        : column.defaultWhenBlank
          ? `Blank means ${column.defaultWhenBlank}`
          : undefined;
    return {
      id: column.key,
      header: column.label,
      required: column.required || conditional,
      ...(conditional && { requiredWhen: REQUIRED_WHEN_MARRIED }),
      ...(dictionary && { dictionary }),
      ...(hint && { hint }),
    };
  }
);

const LOAN_COLUMNS: TemplateColumn[] = [
  { id: "account_no", header: "Account No.", required: true },
  { id: "loan_no", header: "Loan No.", required: true },
  { id: "loan_amount", header: "Loan Amount", required: true },
  { id: "loan_balance", header: "Loan Balance", required: true },
  { id: "interest_rate", header: "Interest Rate", required: true },
  { id: "interest_amount", header: "Interest Amount", required: true },
  { id: "interest_balance", header: "Interest Balance", required: true },
  { id: "purpose", header: "Purpose", required: true },
  { id: "loan_product", header: "Loan Product", required: true },
  { id: "term_months", header: "Term in Months", required: true },
  {
    id: "payment_frequency",
    header: "Payment Frequency",
    required: true,
    dictionary: "payment_frequency",
  },
  {
    id: "interest_type",
    header: "Interest Type",
    required: true,
    dictionary: "interest_type",
  },
  {
    id: "date_released",
    header: "Date Released",
    required: true,
    hint: "YYYY-MM-DD",
  },
  {
    id: "maturity_date",
    header: "Maturity Date",
    required: true,
    hint: "YYYY-MM-DD",
  },
  { id: "processing_fee", header: "Processing Fee", required: false },
  { id: "service_fee", header: "Service Fee", required: false },
  { id: "other_fee_detail", header: "Other Fee Detail", required: false },
  { id: "other_fee_amount", header: "Other Fee Amount", required: false },
];

/**
 * What each share capital column takes, in a few words: the import's own
 * rules (`ShareCapitalRowNormalizer`). Transaction Type's two words are its
 * dictionary instead.
 */
const SHARE_CAPITAL_HINTS: Partial<Record<string, string>> = {
  account_no: "Account No. on Members, or a member ID in Lendyph",
  transaction_date: "YYYY-MM-DD",
  reference_number: "One per transaction",
  amount: "Above ₱0.00, 2 decimals at most",
  remarks: "The entry's description",
};

/**
 * The Share Capital sheet is the share capital import's own column table,
 * read from `SHARE_CAPITAL_COLUMNS` as the Members sheet is from
 * `CUSTOMER_COLUMNS`, so it can't drift from what the importer reads. The
 * workbook has no such sheet (finish run round 2, decision 13).
 */
const SHARE_CAPITAL_TEMPLATE_COLUMNS: TemplateColumn[] = SHARE_CAPITAL_COLUMNS.map(
  (column: ImportColumn): TemplateColumn => {
    const dictionary = isDictionaryKey(column.key) ? column.key : undefined;
    const hint = SHARE_CAPITAL_HINTS[column.key];
    return {
      id: column.key,
      header: column.label,
      required: column.required,
      ...(dictionary && { dictionary }),
      ...(hint && { hint }),
    };
  }
);

/** The sheets, with no rows. `createDraft` is what gives them one to type in. */
export const TEMPLATE_SHEETS: TemplateSheet[] = [
  {
    id: "members",
    name: "Members",
    description:
      "One row per member. Account numbers must be unique across this sheet.",
    columns: MEMBER_COLUMNS,
    rows: [],
  },
  {
    id: "loans",
    name: "Loans",
    description:
      "One row per loan account. Every Account No. here must also exist on Members.",
    columns: LOAN_COLUMNS,
    rows: [],
  },
  {
    id: "share_capital",
    name: "Share Capital",
    description:
      "One row per share capital contribution or withdrawal. Name each member by an Account No. on Members, or by their member ID in Lendyph.",
    columns: SHARE_CAPITAL_TEMPLATE_COLUMNS,
    rows: [],
  },
];

/**
 * The workbook's Guidelines sheet, with its "Customer Profile" file called
 * Members, as the Data Import page names it, and the Share Capital file it
 * lacks.
 */
export const TEMPLATE_GUIDELINES: TemplateGuideline[] = [
  { text: "Prepare the Members, Loans and Share Capital data in separate CSV files." },
  {
    text: "Populate the data according to the prescribed column headers. Each record must occupy a separate row.",
  },
  { text: "Remove the header row before submitting the final CSV files." },
  {
    text: "Relationship between the Members and Loans files:",
    points: [
      "A Members account number may exist even if there is no corresponding account number in the Loans file.",
      "Every Loans account number must have a matching account number in the Members file.",
      "Account numbers in the Members file must be unique.",
      "Duplicate account numbers are allowed in the Loans file.",
    ],
  },
  {
    text: "Share Capital rows:",
    points: [
      "Every Share Capital row names its member by an account number on Members, or by their member ID in Lendyph.",
      "Transaction Type is Contribution or Withdrawal, Transaction Date is written YYYY-MM-DD, and Amount is above ₱0.00.",
      "A row with the same reference as an entry already on the ledger, or with no reference the same member, date, type and amount, is skipped.",
    ],
  },
  { text: "If the customer has no middle name, leave the Middle Name field blank." },
  {
    text: "The Spouse First Name, Spouse Last Name, and Spouse Contact Number fields are required when the Civil Status is MARRIED.",
  },
  { text: "Blue fields indicate required data." },
  { text: "Yellow fields indicate optional data." },
];

/**
 * The untouched workbook, served straight from `public/`. Kept beside the
 * transcription so the two can never drift apart silently — if the filename
 * changes, this is the one place it changes.
 */
export const TEMPLATE_FILE = {
  /** URL-encoded: the filename has spaces. */
  url: "/Lendy%20CSV%20Format.xlsm",
  filename: "Lendy CSV Format.xlsm",
} as const;
