/**
 * The result report's codes and fields, in words.
 *
 * The server tags every issue with a code (`date_invalid`,
 * `membership_number_taken`) to group the report by, and names a row-level
 * problem's field `__row`. Neither is for reading, so the report shows these
 * words instead. A code the words have never heard of still reads as words
 * (its own, spaced), never as a key; `import-issue-words.test.ts` lists every
 * code the backend can send and fails on any without its words here.
 *
 * Pure, so it runs under `tsx --test`.
 */

export const ISSUE_CATEGORY_WORDS: Readonly<Record<string, string>> = {
  // Reading the row
  row_column_count: "Wrong number of columns",
  required: "Required field blank",
  truncated: "Shortened to fit",
  invalid: "Not a value the import accepts",

  // Dates
  date_invalid: "Not a date",
  date_required: "Date blank",
  ambiguous_date: "Date reads two ways",
  excel_serial_date: "Excel date number",
  birthdate_future: "Birthdate in the future",
  birthdate_implausible: "Birthdate before 1900",
  birthdate_under_18: "Member under 18",
  date_hired_future: "Date hired in the future",
  date_hired_implausible: "Date hired too early",
  date_hired_before_birthdate: "Date hired before birthdate",
  membership_date_future: "Membership date in the future",

  // Contact details
  contact_number_invalid: "Contact number not accepted",
  contact_number_multiple: "More than one contact number",
  contact_number_unusable: "Contact number unusable",
  email_invalid: "Email not accepted",

  // Choices
  enum_invalid: "Value not recognised",
  enum_required: "Choice blank",
  enum_unmapped: "Value not recognised, left blank",
  member_type_invalid: "Member type not recognised",

  // Membership number
  membership_number_invalid: "Membership number has a character it can't hold",
  membership_number_too_long: "Membership number too long",
  membership_number_member_code: "Membership number looks like a member code",
  membership_number_placeholder: "Membership number is a placeholder",
  membership_number_spaces: "Membership number stored without spaces",
  membership_number_taken: "Membership number already used",
  membership_needs_member_edit: "Membership details need permission to edit members",

  // Numbers and money
  integer_invalid: "Not a whole number",
  integer_out_of_range: "Number out of range",
  integer_required: "Number blank",
  money_invalid: "Not an amount",
  money_negative: "Negative amount",
  money_overflow: "Amount too large",
  money_precision: "More than two decimal places",
  money_required: "Amount blank",
  amount_above_app_maximum: "Amount above the member form's limit",
  rate_invalid: "Not an interest rate",
  rate_overflow: "Interest rate too large",
  rate_required: "Interest rate blank",

  // A loan's figures and schedule
  amount_not_positive: "Loan amount not above zero",
  balance_exceeds_amount: "Balance above the loan amount",
  balance_out_of_range: "Balance out of range",
  interest_negative: "Negative interest",
  interest_balance_exceeds_interest: "Interest balance above the interest",
  interest_balance_out_of_range: "Interest balance out of range",
  maturity_not_after_release: "Maturity not after release",
  maturity_off_schedule: "Maturity off the payment schedule",
  term_disagrees_with_dates: "Term doesn't match the dates",
  term_too_long: "Term too long",
  allocation_residue: "Payments don't spread across the schedule",
  principal_ladder_fallback: "Schedule doesn't add up to the loan amount",
  invariant_violation: "Schedule doesn't add up",
  unexplained_fee: "Other fee without a description",
  deductions_exceed_principal: "Fees above the principal",
  schedule_not_reconstructable: "Payment schedule can't be rebuilt",
  out_of_product_bounds: "Outside the loan product's limits",

  // Matching members, and what became of the row
  borrower_not_found: "Member not found",
  ambiguous_match: "More than one matching member",
  account_no_conflict: "Account number already on another member",
  already_imported: "Already imported",
  matched_existing: "Matched a member already in Lendyph",
  imported_with_warnings: "Imported with warnings",
  invalid_row: "Not imported, as the row has errors",
  import_failed: "Not imported",
  skipped: "Skipped",
  abandoned: "Given up after repeated attempts",
  exception: "Could not be written",
};

/** The prefix of a loan whose product has no match; the product follows it. */
const UNMAPPED_PRODUCT = "unmapped_product:";

/** `some_new_code` → `Some new code`. Words, for a code the map doesn't have yet. */
function spaced(code: string): string {
  const words = code.replace(/[_:]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A report category in words. */
export function categoryWords(code: string): string {
  if (code.startsWith(UNMAPPED_PRODUCT)) {
    const product = code.slice(UNMAPPED_PRODUCT.length);
    return product === "(blank)" ? "No loan product" : `Loan product not matched: ${product}`;
  }
  return ISSUE_CATEGORY_WORDS[code] ?? spaced(code);
}

/**
 * The Field column: the column's own label, which the server sends beside the
 * key, and "Whole row" for a problem with the whole row (`__row`, or `__loan`
 * in the loans file, where a row is a loan).
 */
export function fieldWords(issue: { field: string | null; field_label?: string | null }): string {
  if (issue.field_label) return issue.field_label;
  if (!issue.field) return "—";
  if (issue.field === "__row" || issue.field === "__loan") return "Whole row";
  return spaced(issue.field);
}
