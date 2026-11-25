import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ISSUE_CATEGORY_WORDS, categoryWords, fieldWords } from "./import-issue-words";

/**
 * Every code the backend can put in the result report's `category`, listed
 * from lendyph-backend `origin/development` (app/Services/CsvImport):
 *  - the row notes, `->fail($field, '<code>', …)` and `->warn(…)`, in the
 *    normalizers (the share capital file's `ShareCapitalRowNormalizer`
 *    included), ValueNormalizer and LoanScheduleReconstructor, plus
 *    `CustomerRowNormalizer::MEMBERSHIP_NEEDS_MEMBER_EDIT`;
 *  - the import pass's outcomes, `RowOutcome::failed('<code>', …)` and
 *    `RowOutcome::skipped('<code>', …)` (`ShareCapitalRowImporter`'s too), the
 *    match outcomes it skips with (`BorrowerMatch`), and the categories it
 *    stamps (`imported_with_warnings`, `invalid_row`);
 *  - ErrorReportBuilder's own fallbacks and `out_of_product_bounds`.
 * `unmapped_product:<name>` carries the product's name, and is tested apart.
 *
 * When the backend adds a code, add it here and to the words: this test is
 * what stops a new code reaching the screen as a key.
 */
const BACKEND_CODES = [
  "account_no_conflict", "allocation_residue", "already_imported", "ambiguous_date",
  "ambiguous_match", "amount_above_app_maximum", "amount_not_positive", "abandoned",
  "balance_exceeds_amount", "balance_out_of_range", "birthdate_future", "birthdate_implausible",
  "birthdate_under_18", "borrower_not_found", "contact_number_invalid", "contact_number_multiple",
  "contact_number_unusable", "date_hired_before_birthdate", "date_hired_future",
  "date_hired_implausible", "date_invalid", "date_required", "deductions_exceed_principal",
  "email_invalid", "enum_invalid", "enum_required", "enum_unmapped", "excel_serial_date",
  "exception", "import_failed", "imported_with_warnings", "integer_invalid",
  "integer_out_of_range", "integer_required", "interest_balance_exceeds_interest",
  "interest_balance_out_of_range", "interest_negative", "invalid", "invalid_row",
  "invariant_violation", "matched_existing", "maturity_not_after_release",
  "maturity_off_schedule", "member_type_invalid", "membership_date_future",
  "membership_needs_member_edit", "membership_number_invalid", "membership_number_member_code",
  "membership_number_placeholder", "membership_number_spaces", "membership_number_taken",
  "membership_number_too_long", "money_invalid", "money_negative", "money_overflow",
  "money_precision", "money_required", "out_of_product_bounds", "principal_ladder_fallback",
  "rate_invalid", "rate_overflow", "rate_required", "required", "row_column_count",
  "schedule_not_reconstructable", "skipped", "term_disagrees_with_dates", "term_too_long",
  "truncated", "unexplained_fee",
  // The share capital file (finish run round 2, decision 13).
  "account_no_too_long", "amount_zero", "branch_closed", "cash_reference_too_large",
  "duplicate_in_file", "duplicate_reference", "duplicate_transaction", "member_moved",
  "member_withdrawn", "not_a_member", "reference_number_too_long", "share_capital_needs_permission",
  "transaction_date_future", "transaction_date_implausible", "transaction_type_invalid",
  "transaction_type_required", "withdrawal_exceeds_balance",
  // A Loan No. past its column is refused, never cut, and one an earlier
  // import cut to the same first 20 characters is refused (finish run round 4).
  "loan_no_too_long", "loan_no_shortened_earlier",
];

test("every code the backend can send has its words", () => {
  const unmapped = BACKEND_CODES.filter((code) => !Object.hasOwn(ISSUE_CATEGORY_WORDS, code));
  assert.deepEqual(unmapped, [], `codes with no words: ${unmapped.join(", ")}`);
});

test("the words are words: no underscores, no keys", () => {
  for (const code of BACKEND_CODES) {
    assert.doesNotMatch(categoryWords(code), /_|:/, code);
  }
  assert.equal(categoryWords("membership_number_spaces"), "Membership number stored without spaces");
  assert.equal(categoryWords("membership_number_taken"), "Membership number already used");
  assert.equal(categoryWords("borrower_not_found"), "Member not found", "Member, never Borrower");
});

test("the share capital file's codes read as what happened to the entry", () => {
  assert.equal(categoryWords("duplicate_reference"), "Reference already on the ledger");
  assert.equal(categoryWords("duplicate_transaction"), "Same entry already on the ledger");
  assert.equal(categoryWords("duplicate_in_file"), "Repeats an earlier row of the file");
  assert.equal(categoryWords("withdrawal_exceeds_balance"), "Withdrawal above the balance");
  assert.equal(categoryWords("amount_zero"), "Amount of ₱0.00");
});

test("an identifier past its column reads the same in every file: never cut, refused", () => {
  // The members and loans files' Account No. (finish run round 4), and the
  // share capital file's account number or member ID.
  assert.equal(categoryWords("account_no_too_long"), "Account number too long");
  assert.equal(categoryWords("loan_no_too_long"), "Loan number too long");
  assert.equal(categoryWords("loan_no_shortened_earlier"), "Loan number shortened by an earlier import");
});

test("an unmatched loan product reads with its name", () => {
  assert.equal(categoryWords("unmapped_product:Salary Loan"), "Loan product not matched: Salary Loan");
  assert.equal(categoryWords("unmapped_product:(blank)"), "No loan product");
});

test("a code the words have never heard of still reads as words", () => {
  assert.equal(categoryWords("some_new_code"), "Some new code");
});

test("the Field column shows the column's own label, and a row-level problem reads Whole row", () => {
  assert.equal(fieldWords({ field: "membership_number", field_label: "Membership Number" }), "Membership Number");
  assert.equal(fieldWords({ field: "__row", field_label: "" }), "Whole row");
  assert.equal(fieldWords({ field: "__loan" }), "Whole row");
  assert.equal(fieldWords({ field: null }), "—");
  assert.equal(fieldWords({ field: "date_hired" }), "Date hired");
});

test("the result report shows the words, never the codes", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/(app)/settings/data-import/_components/import-errors-table.tsx"),
    "utf8",
  );
  assert.match(source, /categoryWords\(stat\.category\)/);
  assert.match(source, /categoryWords\(issue\.category\)/);
  assert.match(source, /fieldWords\(issue\)/);
  // Shown as text, that is; a React key may still carry the code (`${stat.category}`).
  assert.doesNotMatch(source, /(?<!\$)\{stat\.category\}|(?<!\$)\{issue\.category\}|\{issue\.field \|\| "—"\}/);
});
