import type {
  DictionaryKey,
  TemplateColumn,
  TemplateGuideline,
  TemplateSheet,
} from "./types";

/**
 * `public/Lendy CSV Format.xlsm`, transcribed.
 *
 * `required` is the workbook's own colour coding — blue (#00B0F0) required,
 * yellow (#FFFF00) optional — read off the header row. If the workbook is ever
 * re-issued, this file is what has to move with it, and the download button
 * still serves the real thing either way.
 */

const REQUIRED_WHEN_MARRIED = "Required when Civil Status is Married";

const CUSTOMER_PROFILE_COLUMNS: TemplateColumn[] = [
  { id: "account_no", header: "Account No.", required: true },
  { id: "last_name", header: "Last Name", required: true },
  { id: "first_name", header: "First Name", required: true },
  { id: "middle_name", header: "Middle Name", required: false },
  { id: "suffix", header: "Suffix", required: false, dictionary: "suffix" },
  {
    id: "birthdate",
    header: "Birthdate",
    required: true,
    hint: "YYYY-MM-DD",
  },
  { id: "gender", header: "Gender", required: true, dictionary: "gender" },
  {
    id: "civil_status",
    header: "Civil Status",
    required: true,
    dictionary: "civil_status",
  },
  { id: "contact_number", header: "Contact Number", required: true },
  { id: "email", header: "Email", required: true },
  { id: "street_address", header: "Street Address", required: false },
  { id: "barangay", header: "Barangay", required: true },
  { id: "city", header: "City/Municipality", required: true },
  { id: "province", header: "Province", required: true },
  { id: "employer", header: "Employer/Business Name", required: false },
  { id: "monthly_income", header: "Monthly Income", required: false },
  {
    id: "pledge_amount",
    header: "Pledge Amt (If Applicable)",
    required: false,
  },
  {
    id: "spouse_first_name",
    header: "Spouse FName (If Married)",
    required: true,
    requiredWhen: REQUIRED_WHEN_MARRIED,
  },
  {
    id: "spouse_middle_name",
    header: "Spouse MName (If Married)",
    required: false,
  },
  {
    id: "spouse_last_name",
    header: "Spouse LName (If Married)",
    required: true,
    requiredWhen: REQUIRED_WHEN_MARRIED,
  },
  {
    id: "spouse_contact_no",
    header: "Spouse Contact No (If Married)",
    required: true,
    requiredWhen: REQUIRED_WHEN_MARRIED,
  },
  {
    id: "spouse_occupation",
    header: "Spouse Occupation (If Married)",
    required: false,
  },
];

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

/** The sheets, with no rows. `createDraft` is what gives them one to type in. */
export const TEMPLATE_SHEETS: TemplateSheet[] = [
  {
    id: "customer_profile",
    name: "Customer Profile",
    description:
      "One row per member. Account numbers must be unique across this sheet.",
    columns: CUSTOMER_PROFILE_COLUMNS,
    rows: [],
  },
  {
    id: "loans",
    name: "Loans",
    description:
      "One row per loan account. Every Account No. here must also exist on Customer Profile.",
    columns: LOAN_COLUMNS,
    rows: [],
  },
];

/** The workbook's Data Dictionary sheet. */
export const DATA_DICTIONARY: Record<
  DictionaryKey,
  { label: string; values: string[] }
> = {
  gender: { label: "Gender", values: ["Male", "Female"] },
  civil_status: {
    label: "Civil Status",
    values: ["Single", "Married", "Widowed", "Separated", "Divorced"],
  },
  suffix: { label: "Suffix", values: ["Jr.", "Sr.", "III", "IV", "V"] },
  interest_type: {
    label: "Interest Type",
    values: ["Straight (Fixed)", "Diminishing"],
  },
  payment_frequency: {
    label: "Payment Frequency",
    values: [
      "Daily",
      "Weekly",
      "Bi-Weekly",
      "Semi-Monthly",
      "Monthly",
      "Upon Maturity",
    ],
  },
};

/** The workbook's Guidelines sheet, verbatim. */
export const TEMPLATE_GUIDELINES: TemplateGuideline[] = [
  { text: "Prepare the Customer Profile and Loans data in separate CSV files." },
  {
    text: "Populate the data according to the prescribed column headers. Each record must occupy a separate row.",
  },
  { text: "Remove the header row before submitting the final CSV files." },
  {
    text: "Relationship between the Customer Profile and Loans files:",
    points: [
      "A Customer Profile account number may exist even if there is no corresponding account number in the Loans file.",
      "Every Loans account number must have a matching account number in the Customer Profile file.",
      "Account numbers in the Customer Profile file must be unique.",
      "Duplicate account numbers are allowed in the Loans file.",
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
