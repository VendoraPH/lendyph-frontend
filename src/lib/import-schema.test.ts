import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CIVIL_STATUS_OPTIONS,
  GENDER_OPTIONS,
  INTEREST_TYPE_OPTIONS,
  MEMBER_TYPE_OPTIONS,
  PAYMENT_FREQUENCY_OPTIONS,
  SUFFIX_OPTIONS,
} from "@/constants";
import {
  acceptedWidths,
  columnsFor,
  CUSTOMER_COLUMNS,
  detectHeaderRow,
  earlierLayoutNote,
  identifyShape,
  LOAN_COLUMNS,
  missingRequiredFields,
  blockingSizeProblems,
  fieldSizeProblems,
  headerKey,
  normaliseRow,
  resolveEnumValue,
  resolveRowEnums,
  SHARE_CAPITAL_COLUMNS,
  TRANSACTION_TYPE_OPTIONS,
  vocabKey,
  type EnumOption,
  type ImportShape,
} from "./import-schema";

// ── Fixtures ───────────────────────────────────────────────────────────────

// Typed as plain strings on purpose: the tables are `as const`, so their
// labels come back as a literal union that a "renamed column" test cannot
// write into. Real callers hold arbitrary strings off a CSV anyway.
const CUSTOMER_HEADER: string[] = CUSTOMER_COLUMNS.map((c) => c.label);
const LOANS_HEADER: string[] = LOAN_COLUMNS.map((c) => c.label);

/** A plausible 22-cell member row, headerless, as the spec sheet asks for. */
const CUSTOMER_ROW = [
  "2020-0041", "Dela Cruz", "Juan", "Santos", "Jr.", "03/04/1985", "Male",
  "Married", "09171234567", "juan.delacruz@gmail.com", "12 Mabini St",
  "Poblacion", "Tagum City", "Davao del Norte", "Tagum Farmers Supply",
  "18000", "5000", "Maria", "Reyes", "Dela Cruz", "09181234567", "Teacher",
];

/** A plausible 18-cell loans row. */
const LOANS_ROW = [
  "2020-0041", "LN-000123", "50,000.00", "32,500.00", "3.5", "5,250.00",
  "1,750.00", "Business Capital", "Regular Loan", "12", "Monthly",
  "Diminishing", "15/01/2020", "15/01/2021", "500", "250", "Notarial", "150",
];

// ── The column tables ──────────────────────────────────────────────────────

test("the customer sheet is the client's 22 columns in their exact order, then the four Member Profile columns", () => {
  assert.equal(CUSTOMER_COLUMNS.length, 26);
  assert.deepEqual(CUSTOMER_HEADER, [
    "Account No.", "Last Name", "First Name", "Middle Name", "Suffix",
    "Birthdate", "Gender", "Civil Status", "Contact Number", "email",
    "Street Address", "Barangay", "City/Municipality", "Province",
    "Employer/Business Name", "Monthly Income", "Pledge Amt(If Applicable)",
    "Spouse FName (If Married)", "Spouse MName (If Married)",
    "Spouse LName (If Married)", "Spouse Contact No (If Married)",
    "Spouse Occupation (If Married)",
    // Appended, never inserted: the file is read by position, so a column
    // anywhere else would move every value of an older file one field over.
    "Date Hired", "Membership Date", "Member Type", "Membership Number",
  ]);
});

test("a members file may be in today's layout or the workbook's 22-column one; loans have one", () => {
  assert.deepEqual(acceptedWidths("customer"), [26, 22]);
  assert.deepEqual(acceptedWidths("loans"), [18]);
});

test("the four new columns are optional and typed as the app stores them", () => {
  const added = CUSTOMER_COLUMNS.slice(22);
  assert.deepEqual(added.map((c) => [c.key, c.type, c.required]), [
    ["date_hired", "date", false],
    ["membership_date", "date", false],
    ["member_type", "enum", false],
    ["membership_number", "text", false],
  ]);
  assert.equal(column("customer", "membership_number").maxLength, 30);
});

test("only a file in the earlier layout gets the note, and it says what its rows get", () => {
  // Member Type is not left blank: the column's default, Regular, is stored.
  assert.equal(
    earlierLayoutNote("customer", 22),
    "This file is in the earlier 22-column layout, without Date Hired, Membership Date, Member Type and Membership Number. Its rows import as before, with Date Hired, Membership Date and Membership Number left blank, and Member Type read as Regular, the default.",
  );
  assert.equal(earlierLayoutNote("customer", 26), null);
  assert.equal(earlierLayoutNote("customer", 24), null);
  assert.equal(earlierLayoutNote("loans", 18), null);
});

test("the loans sheet is 18 columns in the client's exact order", () => {
  assert.equal(LOAN_COLUMNS.length, 18);
  assert.deepEqual(LOANS_HEADER, [
    "Account No.", "Loan No.", "Loan Amount", "Loan Balance", "Interest Rate",
    "Interest Amount", "Interest Balance", "Purpose", "Loan Product",
    "Term in Months", "Payment Frequency", "Interest Type", "Date Released",
    "Maturity Date", "Processing Fee", "Service Fee", "Other Fee Detail",
    "Other Fee Amount",
  ]);
});

test("field keys are unique within each sheet", () => {
  for (const shape of ["customer", "loans"] as const) {
    const keys = columnsFor(shape).map((c) => c.key);
    assert.equal(new Set(keys).size, keys.length, `${shape} has a duplicate key`);
  }
});

test("the required columns are exactly the starred ones", () => {
  const required = CUSTOMER_COLUMNS.filter((c) => c.required).map((c) => c.label);
  assert.deepEqual(required, [
    "Account No.", "Last Name", "First Name", "Birthdate", "Gender",
    "Civil Status", "Contact Number", "email", "Barangay", "City/Municipality",
    "Province",
  ]);
  assert.equal(LOAN_COLUMNS.filter((c) => c.required).length, 14);
  assert.deepEqual(
    LOAN_COLUMNS.filter((c) => !c.required).map((c) => c.label),
    ["Processing Fee", "Service Fee", "Other Fee Detail", "Other Fee Amount"],
  );
});

test("only the three starred spouse fields are conditionally required", () => {
  assert.deepEqual(
    columnsFor("customer").filter((c) => c.requiredWhen).map((c) => c.label),
    ["Spouse FName (If Married)", "Spouse LName (If Married)",
      "Spouse Contact No (If Married)"],
  );
});

// ── What the server refuses (finish run round 3) ───────────────────────────

test("a blank member cell is refused only in Account No., Last Name or First Name; `required` stays the workbook's colours", () => {
  const blank = normaliseRow([], "customer");
  assert.deepEqual(
    missingRequiredFields(blank, "customer").map((field) => [field.label, field.refused]),
    [
      ["Account No.", true], ["Last Name", true], ["First Name", true],
      ["Birthdate", false], ["Gender", false], ["Civil Status", false],
      ["Contact Number", false], ["email", false], ["Barangay", false],
      ["City/Municipality", false], ["Province", false],
    ],
  );
});

test("a married member's blank spouse cells are asked for, never refused", () => {
  const spouseless = [...CUSTOMER_ROW];
  spouseless[17] = "";
  spouseless[19] = "";
  spouseless[20] = "";
  assert.deepEqual(
    missingRequiredFields(normaliseRow(spouseless, "customer"), "customer").map((field) => [field.label, field.refused]),
    [
      ["Spouse FName (If Married)", false],
      ["Spouse LName (If Married)", false],
      ["Spouse Contact No (If Married)", false],
    ],
  );
});

test("the share capital file still refuses every blank required cell", () => {
  const missing = missingRequiredFields(normaliseRow([], "share_capital"), "share_capital");
  assert.deepEqual(
    missing.map((field) => field.label),
    columnsFor("share_capital").filter((c) => c.required).map((c) => c.label),
  );
  assert.ok(missing.every((field) => field.refused));
});

test("a blank loan cell is refused but in Purpose and Loan Product, which the server imports (finish run round 4)", () => {
  const missing = missingRequiredFields(normaliseRow([], "loans"), "loans");
  assert.deepEqual(
    missing.map((field) => [field.label, field.refused]),
    columnsFor("loans").filter((c) => c.required).map((c) => [c.label, c.key !== "purpose" && c.key !== "loan_product"]),
  );
  // What becomes of each, said where the Check step shows it.
  assert.deepEqual(
    missing.filter((field) => !field.refused).map((field) => [field.label, field.whenBlank]),
    [
      ["Purpose", "The loan will be imported with no purpose."],
      ["Loan Product", "The loan will still import: on the Processing step, choose a product for the loans with no product named."],
    ],
  );
  // `required` stays the workbook's colours: both are still blue.
  assert.equal(column("loans", "purpose").required, true);
  assert.equal(column("loans", "loan_product").required, true);
});

// ── Header detection ───────────────────────────────────────────────────────

test("the exact header row is recognised, in position, with no mismatches", () => {
  const result = detectHeaderRow(CUSTOMER_HEADER, "customer");
  assert.equal(result.isHeader, true);
  assert.equal(result.positionalScore, 1);
  assert.equal(result.labelScore, 1);
  assert.equal(result.reordered, false);
  assert.deepEqual(result.mismatched, []);
});

test("case, spacing and punctuation differences are still the header", () => {
  const scruffy = [
    "ACCOUNT NO", "last  name", " First Name ", "middle_name", "SUFFIX",
    "birth date", "gender", "civil-status", "Contact  Number", "E-MAIL",
    "street address", "BARANGAY", "City / Municipality", "province",
    "Employer / Business Name", "monthly income", "PLEDGE AMT",
    "spouse fname", "Spouse  MName", "SPOUSE LNAME", "spouse contact no",
    "Spouse Occupation.",
  ];
  const result = detectHeaderRow(scruffy, "customer");
  assert.equal(result.isHeader, true);
  assert.equal(result.positionalScore, 1, "every label should still match");
  assert.deepEqual(result.mismatched, []);
});

/**
 * The customer header EXACTLY as it appears in the client's workbook, lifted
 * from `sharedStrings.xml`: parenthetical qualifiers on six columns, no space
 * before the bracket on `Pledge Amt(If Applicable)` but a space on the spouse
 * ones, leading spaces on several cells, and a lowercase `email` among title
 * case. Written out verbatim rather than derived from CUSTOMER_COLUMNS so that
 * this stays a test of the real file and not of our own list.
 */
const WORKBOOK_HEADER = [
  "Account No.", " Last Name", "First Name", "Middle Name", "Suffix",
  "Birthdate", "Gender", "Civil Status", "Contact Number", "email",
  "Street Address", "Barangay", "City/Municipality", "  Province",
  "Employer/Business Name", "Monthly Income", "Pledge Amt(If Applicable)",
  "Spouse FName (If Married)", "Spouse MName (If Married)",
  "Spouse LName (If Married)", "Spouse Contact No (If Married)",
  "Spouse Occupation (If Married)",
];

test("the workbook's own header row, warts and all, is a clean detection", () => {
  const result = detectHeaderRow(WORKBOOK_HEADER, "customer");
  assert.equal(result.isHeader, true);
  assert.equal(result.positionalScore, 1, "every workbook label should match");
  assert.equal(result.labelScore, 1);
  assert.equal(result.reordered, false);
  assert.deepEqual(result.mismatched, []);
  assert.equal(identifyShape(WORKBOOK_HEADER).shape, "customer");
});

test("a retyped sheet that drops the qualifiers still matches", () => {
  // A cooperative retyping the sheet writes `Pledge Amt` and `Spouse FName`.
  // Same columns, so they must key the same — without the qualifier strip this
  // is six misses out of 22, which alone can drag a real header under the
  // threshold and get it imported as a member.
  const retyped = [
    "Account No.", "Last Name", "First Name", "Middle Name", "Suffix",
    "Birthdate", "Gender", "Civil Status", "Contact Number", "Email",
    "Street Address", "Barangay", "City/Municipality", "Province",
    "Employer/Business Name", "Monthly Income", "Pledge Amt", "Spouse FName",
    "Spouse MName", "Spouse LName", "Spouse Contact No", "Spouse Occupation",
  ];
  const result = detectHeaderRow(retyped, "customer");
  assert.equal(result.isHeader, true);
  assert.equal(result.positionalScore, 1);
  assert.deepEqual(result.mismatched, []);
});

test("headerKey drops the qualifier but vocabKey does not", () => {
  // Kept apart deliberately: `Straight (Fixed)` carries meaning in its
  // brackets, so vocabulary matching must not strip them.
  assert.equal(headerKey("Pledge Amt(If Applicable)"), "pledgeamt");
  assert.equal(headerKey("Spouse FName (If Married)"), "spousefname");
  assert.equal(headerKey("  Province"), "province");
  assert.equal(headerKey("Pledge Amt"), headerKey("Pledge Amt(If Applicable)"));
  assert.equal(vocabKey("Straight (Fixed)"), "straightfixed");
  assert.notEqual(vocabKey("Pledge Amt(If Applicable)"), vocabKey("Pledge Amt"));
});

test("the qualifier strip does not collapse two columns onto one key", () => {
  // The risk of stripping: if two labels differed ONLY inside their brackets
  // they would become indistinguishable and the header would silently mis-map.
  for (const shape of ["customer", "loans"] as const) {
    const keys = columnsFor(shape).map((c) => headerKey(c.label));
    assert.equal(new Set(keys).size, keys.length, `${shape} keys collide`);
    assert.ok(keys.every(Boolean), `${shape} has an empty key`);
  }
});

test("the loans header carries no qualifiers and is unaffected", () => {
  const result = detectHeaderRow(LOANS_HEADER, "loans");
  assert.equal(result.positionalScore, 1);
  assert.deepEqual(LOAN_COLUMNS.map((c) => c.label).filter((l) => l.includes("(")), []);
});

test("no header at all — a data row scores near zero", () => {
  const result = detectHeaderRow(CUSTOMER_ROW, "customer");
  assert.equal(result.isHeader, false);
  assert.equal(result.labelScore, 0);
});

test("a data row that coincidentally looks header-ish is still not a header", () => {
  // A borrower whose employer really is called "Street Address" and who lives
  // in a barangay called "Province". Two hits out of 22 is not a header, and
  // this is why the threshold is a share of the label set rather than "any".
  const trap = [...CUSTOMER_ROW];
  trap[14] = "Street Address";
  trap[11] = "Province";
  trap[8] = "Contact Number";
  const result = detectHeaderRow(trap, "customer");
  assert.equal(result.isHeader, false);
  assert.ok(result.labelScore < 0.2, `labelScore was ${result.labelScore}`);
});

test("'is the first cell numeric' would have been the wrong signal", () => {
  // Account numbers here are alphanumeric, so that test calls every real data
  // row a header and silently drops the first member of the file.
  assert.equal(Number.isNaN(Number(CUSTOMER_ROW[0])), true);
  assert.equal(detectHeaderRow(CUSTOMER_ROW, "customer").isHeader, false);
});

test("a header with two columns renamed is still detected, and says which", () => {
  const renamed = [...CUSTOMER_HEADER];
  renamed[8] = "Mobile Number";
  renamed[12] = "Municipality";
  const result = detectHeaderRow(renamed, "customer");
  assert.equal(result.isHeader, true);
  assert.deepEqual(
    result.mismatched.map((m) => [m.index, m.expected, m.found]),
    [[8, "Contact Number", "Mobile Number"], [12, "City/Municipality", "Municipality"]],
  );
});

test("a REORDERED header is flagged rather than mistaken for data", () => {
  // Labels all present, positions wrong. Importing this positionally would put
  // provinces in the email column; calling it "not a header" would import the
  // labels as a borrower. Neither is acceptable, so it gets its own flag.
  const shuffled = [...CUSTOMER_HEADER].reverse();
  const result = detectHeaderRow(shuffled, "customer");
  assert.equal(result.isHeader, true);
  assert.equal(result.labelScore, 1);
  assert.ok(result.positionalScore < 0.6);
  assert.equal(result.reordered, true);
});

test("a header is held to the file's width, as the server holds it", () => {
  // The workbook's 22 labels over 26-column rows: still the header, but the
  // four appended columns have no label, which the server refuses.
  const short = detectHeaderRow(WORKBOOK_HEADER, "customer", 26);
  assert.equal(short.isHeader, true);
  assert.deepEqual(
    short.mismatched.map((m) => [m.index, m.expected, m.found]),
    [[22, "Date Hired", ""], [23, "Membership Date", ""], [24, "Member Type", ""], [25, "Membership Number", ""]],
  );

  // Today's 26 labels over rows in the earlier layout: read against their 22.
  const full = detectHeaderRow(CUSTOMER_HEADER, "customer", 22);
  assert.equal(full.positionalScore, 1);
  assert.deepEqual(full.mismatched, []);
});

test("the loans header is detected against its own label set", () => {
  assert.equal(detectHeaderRow(LOANS_HEADER, "loans").positionalScore, 1);
});

// ── Wrong-slot discrimination ──────────────────────────────────────────────

test("headers identify their own sheet", () => {
  const customer = identifyShape(CUSTOMER_HEADER);
  assert.equal(customer.shape, "customer");
  assert.equal(customer.basis, "header");

  const loans = identifyShape(LOANS_HEADER);
  assert.equal(loans.shape, "loans");
  assert.equal(loans.basis, "header");
});

test("the two header rows barely overlap, so the slot call is not close", () => {
  // `Account No.` is the ONLY label the two sheets share. `Loan No.` sits where
  // `Last Name` does, and the six parentheticals are customer-only shapes the
  // loans file cannot accidentally produce.
  const loansAgainstCustomer = detectHeaderRow(LOANS_HEADER, "customer");
  const customerAgainstLoans = detectHeaderRow(WORKBOOK_HEADER, "loans");
  assert.ok(loansAgainstCustomer.labelScore < 0.1, `${loansAgainstCustomer.labelScore}`);
  assert.ok(customerAgainstLoans.labelScore < 0.1, `${customerAgainstLoans.labelScore}`);
  assert.equal(loansAgainstCustomer.isHeader, false);
  assert.equal(customerAgainstLoans.isHeader, false);

  const shared = LOAN_COLUMNS.map((c) => headerKey(c.label)).filter((k) =>
    CUSTOMER_COLUMNS.some((c) => headerKey(c.label) === k),
  );
  assert.deepEqual(shared, ["accountno"]);
});

test("headerless data rows identify their own sheet from their contents", () => {
  const customer = identifyShape(CUSTOMER_ROW);
  assert.equal(customer.shape, "customer");
  assert.equal(customer.basis, "content");
  assert.ok(customer.customerScore > customer.loansScore);

  const loans = identifyShape(LOANS_ROW);
  assert.equal(loans.shape, "loans");
  assert.equal(loans.basis, "content");
  assert.ok(loans.loansScore > loans.customerScore);
});

test("a members row in the server's other words, M or Legally Separated, is as plainly the members file", () => {
  const terse = [...CUSTOMER_ROW];
  terse[6] = "M";
  terse[7] = "Legally Separated";
  assert.equal(identifyShape(terse).customerScore, identifyShape(CUSTOMER_ROW).customerScore);
});

test("the loans file dropped into the customer slot is caught", () => {
  // The mistake this exists for. Left undetected the import writes loan
  // amounts into birthdates and nothing about the result looks wrong.
  assert.equal(identifyShape(LOANS_ROW).shape, "loans");
  assert.equal(identifyShape(LOANS_HEADER).shape, "loans");
});

test("a loans row of bare integers is still not mistaken for a customer", () => {
  // Lowering MIN_EXCEL_SERIAL to 1910 means a 4-digit amount now falls inside
  // the Excel serial window, so a comma-less loans row scores a spurious hit on
  // the customer fingerprint at index 5 (interest_amount vs birthdate). The
  // lead has to stay decisive anyway — this is the regression guard for it.
  const bare = ["2020-0041", "LN-1", "50000", "32500", "3.5", "5250", "1750",
    "Capital", "Regular", "12", "Monthly", "Straight (Fixed)", "15/01/2020",
    "15/01/2021", "500", "250", "", "0"];
  const guess = identifyShape(bare);
  assert.equal(guess.shape, "loans");
  assert.ok(
    guess.loansScore - guess.customerScore > 0.5,
    `lead too narrow: loans ${guess.loansScore} vs customer ${guess.customerScore}`,
  );
});

test("a record resembling neither sheet is named as neither", () => {
  assert.equal(identifyShape(["a", "b", "c"]).shape, null);
  assert.equal(identifyShape([]).shape, null);
});

test("column count alone does not decide it", () => {
  // 22 or 26 empty cells is a right width and no evidence of anything.
  assert.equal(identifyShape(Array(22).fill("")).shape, null);
  assert.equal(identifyShape(Array(26).fill("")).shape, null);
});

test("a member row in today's 26-column layout identifies as a customer too", () => {
  const current = [...CUSTOMER_ROW, "2012-06-01", "2010-03-15", "Associate", "BC-0007"];
  const guess = identifyShape(current);
  assert.equal(guess.shape, "customer");
  assert.equal(guess.customerScore, 1);
});

test("a customer row missing its trailing spouse columns is still a customer", () => {
  assert.equal(identifyShape(CUSTOMER_ROW.slice(0, 18)).shape, "customer");
});

// ── normaliseRow ───────────────────────────────────────────────────────────

test("normaliseRow maps positional cells onto named fields", () => {
  const row = normaliseRow([...CUSTOMER_ROW, "2012-06-01", "2010-03-15", "Associate", "BC-0007"], "customer");
  assert.equal(row.account_no, "2020-0041");
  assert.equal(row.birthdate, "03/04/1985");
  assert.equal(row.email, "juan.delacruz@gmail.com");
  assert.equal(row.spouse_occupation, "Teacher");
  assert.equal(row.date_hired, "2012-06-01");
  assert.equal(row.membership_date, "2010-03-15");
  assert.equal(row.member_type, "Associate");
  assert.equal(row.membership_number, "BC-0007");
  assert.equal(Object.keys(row).length, CUSTOMER_COLUMNS.length);
});

test("a row in the workbook's 22-column layout reads the four new fields as blank", () => {
  const row = normaliseRow(CUSTOMER_ROW, "customer");
  assert.equal(row.spouse_occupation, "Teacher", "every old column keeps its place");
  assert.deepEqual(
    [row.date_hired, row.membership_date, row.member_type, row.membership_number],
    ["", "", "", ""],
  );
  assert.deepEqual(missingRequiredFields(row, "customer"), []);
  assert.deepEqual(resolveRowEnums(row, "customer").unknown, []);
  assert.deepEqual(fieldSizeProblems(row, "customer"), []);
});

test("normaliseRow maps the loans sheet's own fields", () => {
  const row = normaliseRow(LOANS_ROW, "loans");
  assert.equal(row.loan_no, "LN-000123");
  assert.equal(row.term_months, "12");
  assert.equal(row.maturity_date, "15/01/2021");
  assert.equal(row.other_fee_amount, "150");
});

test("a short record fills missing fields with blanks, not undefined", () => {
  const row = normaliseRow(["2020-0041", "Dela Cruz"], "customer");
  assert.equal(row.first_name, "");
  assert.equal(row.spouse_occupation, "");
  assert.equal(row.membership_number, "");
  assert.equal(Object.keys(row).length, CUSTOMER_COLUMNS.length);
});

test("trailing cells beyond the schema are dropped and values trimmed", () => {
  const row = normaliseRow(["  2020-0041  ", ...CUSTOMER_ROW.slice(1), "", "", "", "", "extra"], "customer");
  assert.equal(row.account_no, "2020-0041");
  assert.equal(row.membership_number, "");
  assert.equal(Object.keys(row).length, CUSTOMER_COLUMNS.length);
});

// ── Required fields, including the married rule ────────────────────────────

/** The labels of a row's blank required cells, in column order. */
function blankLabels(row: Record<string, string>, shape: ImportShape): string[] {
  return missingRequiredFields(row, shape).map((field) => field.label);
}

test("a complete row is missing nothing", () => {
  assert.deepEqual(missingRequiredFields(normaliseRow(CUSTOMER_ROW, "customer"), "customer"), []);
  assert.deepEqual(missingRequiredFields(normaliseRow(LOANS_ROW, "loans"), "loans"), []);
});

test("blank required fields are reported by their printed label", () => {
  const row = normaliseRow(["", "", "Juan", ...CUSTOMER_ROW.slice(3)], "customer");
  assert.deepEqual(blankLabels(row, "customer"), ["Account No.", "Last Name"]);
});

test("a married member must supply the three starred spouse fields", () => {
  const spouseless = [...CUSTOMER_ROW];
  spouseless[17] = "";
  spouseless[19] = "";
  spouseless[20] = "";
  const row = normaliseRow(spouseless, "customer");
  assert.deepEqual(blankLabels(row, "customer"), [
    "Spouse FName (If Married)", "Spouse LName (If Married)",
    "Spouse Contact No (If Married)",
  ]);
});

test("a single member need not, and the spouse's middle name is never required", () => {
  const single = [...CUSTOMER_ROW];
  single[7] = "Single";
  single[17] = "";
  single[18] = "";
  single[19] = "";
  single[20] = "";
  assert.deepEqual(missingRequiredFields(normaliseRow(single, "customer"), "customer"), []);
});

test("the married rule fires on any spelling of MARRIED the server reads", () => {
  const spouseless = (spelling: string) =>
    normaliseRow(CUSTOMER_ROW.map((cell, i) => (i === 7 ? spelling : i === 17 ? "" : cell)), "customer");
  for (const spelling of ["MARRIED", " married ", "Married.", "Married"]) {
    assert.deepEqual(
      blankLabels(spouseless(spelling), "customer"),
      ["Spouse FName (If Married)"],
      `spelling "${spelling}" did not trigger the spouse requirement`,
    );
  }
  // The server imports "maried" blank, so the member isn't married there.
  assert.deepEqual(blankLabels(spouseless("maried"), "customer"), []);
});

// ── Vocabularies ───────────────────────────────────────────────────────────

/** Locate a column by key so the enum tests read like the file does. */
function column(shape: ImportShape, key: string) {
  const found = columnsFor(shape).find((c) => c.key === key);
  assert.ok(found, `no ${key} column on the ${shape} sheet`);
  return found;
}

const VOCABULARIES: [ImportShape, string, readonly EnumOption[]][] = [
  ["customer", "gender", GENDER_OPTIONS],
  ["customer", "civil_status", CIVIL_STATUS_OPTIONS],
  ["customer", "suffix", SUFFIX_OPTIONS],
  ["customer", "member_type", MEMBER_TYPE_OPTIONS],
  ["loans", "interest_type", INTEREST_TYPE_OPTIONS],
  ["loans", "payment_frequency", PAYMENT_FREQUENCY_OPTIONS],
];

test("every value of every vocabulary resolves, by stored value AND by label", () => {
  for (const [shape, key, options] of VOCABULARIES) {
    const col = column(shape, key);
    for (const option of options) {
      if (option.value !== "") {
        assert.deepEqual(
          resolveEnumValue(col, option.value),
          { ok: true, value: option.value, label: option.label },
          `${key}: stored value "${option.value}" did not resolve`,
        );
      }
      assert.deepEqual(
        resolveEnumValue(col, option.label),
        { ok: true, value: option.value, label: option.label },
        `${key}: printed label "${option.label}" did not resolve`,
      );
    }
  }
});

test("closed vocabularies reject, open ones do not", () => {
  assert.equal(column("customer", "civil_status").type, "enum");
  assert.equal(column("customer", "gender").type, "enum");
  assert.equal(column("loans", "interest_type").type, "enum");
  assert.equal(column("loans", "payment_frequency").type, "enum");
  assert.equal(column("customer", "suffix").type, "open-enum");
  assert.equal(column("customer", "member_type").type, "enum");
});

test("Member Type is Regular or Associate in any case, stored as the app's value", () => {
  const type = column("customer", "member_type");
  assert.deepEqual(MEMBER_TYPE_OPTIONS.map((o) => [o.value, o.label]), [
    ["regular", "Regular"],
    ["associate", "Associate"],
  ]);
  assert.deepEqual(resolveEnumValue(type, " ASSOCIATE "), { ok: true, value: "associate", label: "Associate" });
  assert.deepEqual(resolveEnumValue(type, "regular"), { ok: true, value: "regular", label: "Regular" });
  assert.equal(resolveEnumValue(type, "Premium").ok, false);
  assert.deepEqual(resolveEnumValue(type, ""), { ok: true, value: "", label: "" }, "blank is not set");
});

test("a membership number is measured as it will be stored: capitals, no spaces", () => {
  const thirty = "BC-" + "7".repeat(27);
  const fits = normaliseRow([...CUSTOMER_ROW, "", "", "", `${thirty.slice(0, 10)} ${thirty.slice(10)}`], "customer");
  assert.deepEqual(fieldSizeProblems(fits, "customer"), [], "30 characters once its space is gone");

  const over = normaliseRow([...CUSTOMER_ROW, "", "", "", `${thirty}7`], "customer");
  const problems = fieldSizeProblems(over, "customer");
  assert.deepEqual(problems.map((p) => [p.key, p.reason, p.severity, p.limit]), [
    ["membership_number", "too-long", "error", 30],
  ]);
});

test("the vocabularies are the ones the app already ships", () => {
  // Sourced from src/constants, not retyped here — if someone adds a civil
  // status or a payment frequency, the importer accepts it the same day.
  assert.deepEqual(PAYMENT_FREQUENCY_OPTIONS.map((o) => o.label), [
    "Daily", "Weekly", "Bi-Weekly", "Semi-Monthly", "Monthly", "Upon Maturity",
  ]);
  assert.deepEqual(INTEREST_TYPE_OPTIONS.map((o) => o.label), [
    "Straight (Fixed)", "Diminishing",
  ]);
  assert.equal(CIVIL_STATUS_OPTIONS.length, 5);
  assert.equal(GENDER_OPTIONS.length, 2);
});

test("the two awkward labels resolve exactly as printed", () => {
  const interest = column("loans", "interest_type");
  assert.equal(resolveEnumValue(interest, "Straight (Fixed)").ok, true);
  assert.deepEqual(resolveEnumValue(interest, "Straight (Fixed)"), {
    ok: true, value: "straight", label: "Straight (Fixed)",
  });

  const frequency = column("loans", "payment_frequency");
  for (const spelling of ["Bi-Weekly", "bi_weekly", "BI WEEKLY", "biweekly", " Bi weekly "]) {
    assert.deepEqual(
      resolveEnumValue(frequency, spelling),
      { ok: true, value: "bi_weekly", label: "Bi-Weekly" },
      `"${spelling}" did not resolve`,
    );
  }
  assert.deepEqual(resolveEnumValue(frequency, "SEMI-MONTHLY"), {
    ok: true, value: "semi_monthly", label: "Semi-Monthly",
  });
  assert.deepEqual(resolveEnumValue(frequency, "upon maturity"), {
    ok: true, value: "upon_maturity", label: "Upon Maturity",
  });
});

test("matching is trimmed and case-insensitive, as the junk arriving demands", () => {
  // The workbook carries no data-validation rules and no macros, so its enum
  // lists were documentation the typist could ignore — and did.
  const civil = column("customer", "civil_status");
  for (const spelling of ["MARRIED", "married", " Married ", "Married."]) {
    assert.equal(resolveEnumValue(civil, spelling).ok, true, spelling);
  }
  const gender = column("customer", "gender");
  for (const [raw, expected] of [["F", "female"], ["f", "female"], ["M", "male"],
    ["FEMALE", "female"], [" male ", "male"]] as const) {
    const result = resolveEnumValue(gender, raw);
    assert.deepEqual(result, { ok: true, value: expected, label: expected === "male" ? "Male" : "Female" });
  }
});

test("a suffix written without its full stop is normalised to the listed one", () => {
  const suffix = column("customer", "suffix");
  for (const [raw, expected] of [["Jr", "Jr."], ["JR", "Jr."], ["jr.", "Jr."],
    ["iii", "III"], ["II", "II"], ["junior", "Jr."], ["2nd", "II"],
    ["SENIOR", "Sr."]] as const) {
    assert.deepEqual(
      resolveEnumValue(suffix, raw),
      { ok: true, value: expected, label: expected },
      `suffix "${raw}" should normalise to "${expected}"`,
    );
  }
});

test("Suffix is an OPEN vocabulary — an unlisted one passes through verbatim", () => {
  // `borrowers.suffix` is varchar(20) validated `nullable|string|max:20`, so
  // the dropdown is an affordance, not a contract. Rejecting a suffix for
  // being uncommon would flag real members over a UI convenience.
  const suffix = column("customer", "suffix");
  for (const raw of ["VIII", "Ph.D.", "Jr III", "Dela Cruz III"]) {
    assert.deepEqual(
      resolveEnumValue(suffix, raw),
      { ok: true, value: raw, label: raw },
      `suffix "${raw}" should pass through untouched`,
    );
  }
});

test("an open vocabulary never lands in the unknown list", () => {
  const messy = [...CUSTOMER_ROW];
  messy[4] = "VIII";
  const { row, unknown } = resolveRowEnums(normaliseRow(messy, "customer"), "customer");
  assert.equal(row.suffix, "VIII");
  assert.deepEqual(unknown, [], "an uncommon suffix is not an error");
});

test("II is offered by the dropdown now, as the client's own spec forgot to", () => {
  assert.ok(
    SUFFIX_OPTIONS.some((o) => o.value === "II"),
    "SUFFIX_OPTIONS should list II",
  );
});

/** Size problems for one cell, by setting that column and leaving the rest valid. */
/** A plausible share capital row: its Amount is the one column left on generic limits. */
const SHARE_CAPITAL_ROW = ["2020-0041", "2026-11-24", "CSH-0001-2026-0001", "Contribution", "500.00", "Monthly build-up"];

function sizeProblem(shape: ImportShape, index: number, value: string) {
  const base = shape === "customer" ? [...CUSTOMER_ROW] : shape === "loans" ? [...LOANS_ROW] : [...SHARE_CAPITAL_ROW];
  base[index] = value;
  const problems = fieldSizeProblems(normaliseRow(base, shape), shape);
  return problems;
}

test("a clean row of either shape has no size problems at all", () => {
  assert.deepEqual(fieldSizeProblems(normaliseRow(CUSTOMER_ROW, "customer"), "customer"), []);
  assert.deepEqual(fieldSizeProblems(normaliseRow(LOANS_ROW, "loans"), "loans"), []);
});

test("an over-length suffix is a SIZE problem, not a vocabulary one", () => {
  // Open does not mean unbounded: the column is varchar(20).
  const problems = sizeProblem("customer", 4, "a".repeat(21));
  assert.equal(problems.length, 1);
  assert.equal(problems[0].label, "Suffix");
  assert.equal(problems[0].reason, "too-long");
  assert.equal(problems[0].limit, 20);
  assert.equal(
    resolveEnumValue(column("customer", "suffix"), "a".repeat(21)).ok,
    true,
    "still not a vocabulary failure — length is a separate question",
  );
  assert.deepEqual(sizeProblem("customer", 4, "a".repeat(20)), []);
});

test("two PH mobiles in one cell is a WARNING — the server keeps the first", () => {
  // 23 characters, so it exceeds varchar(20) as written. But the server's
  // ValueNormalizer::contactNumber() splits it and stores the first number, and
  // the row imports fine. Calling that a failure tells the admin their data is
  // broken when it is not, and sends them hand-fixing rows the importer already
  // handles — on the one screen whose whole job is to be believed.
  const joined = "09171234567/09181234567";
  assert.equal(joined.length, 23);
  const problems = sizeProblem("customer", 8, joined);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].label, "Contact Number");
  assert.equal(problems[0].reason, "multiple-values");
  assert.equal(problems[0].severity, "warning");
  assert.equal(problems[0].kept, "09171234567");
  assert.deepEqual(problems[0].dropped, ["09181234567"]);
  assert.deepEqual(blockingSizeProblems(problems), [], "must not count as a failure");
});

test("every separator the server splits on is recognised", () => {
  // ValueNormalizer splits on / ; and , — and spreadsheets pad them with
  // spaces, which must not end up inside the kept number.
  for (const joined of [
    "09171234567/09181234567",
    "09171234567,09181234567",
    "09171234567;09181234567",
    "09171234567 / 09181234567",
    "09171234567 , 09181234567",
  ]) {
    const problems = sizeProblem("customer", 8, joined);
    assert.equal(problems.length, 1, `"${joined}" should raise exactly one warning`);
    assert.equal(problems[0].reason, "multiple-values", joined);
    assert.equal(problems[0].severity, "warning", joined);
    assert.equal(problems[0].kept, "09171234567", `"${joined}" kept the wrong number`);
    assert.deepEqual(problems[0].dropped, ["09181234567"], joined);
  }
});

test("three numbers report both of the dropped ones", () => {
  const problems = sizeProblem("customer", 8, "09171234567/09181234567/09191234567");
  assert.equal(problems[0].kept, "09171234567");
  assert.deepEqual(problems[0].dropped, ["09181234567", "09191234567"]);
});

test("a single contact number is measured AFTER the server normalises it", () => {
  // Punctuation is stripped before storage, so a cell that is 20+ characters as
  // typed still fits. Judging the raw text would fail a perfectly good row.
  assert.deepEqual(sizeProblem("customer", 8, "09171234567"), []);
  assert.deepEqual(sizeProblem("customer", 8, "0917-123-4567"), []);
  assert.deepEqual(sizeProblem("customer", 8, "(0917) 123 - 4567 "), []);
  assert.deepEqual(sizeProblem("customer", 8, "+63 917 123 4567"), []);
});

test("a contact number too long even after repair is a real error", () => {
  // 21 digits survive normalisation intact, so the server genuinely cannot
  // store it. This is where the warning stops and the failure starts.
  const problems = sizeProblem("customer", 8, "0".repeat(21));
  assert.equal(problems.length, 1);
  assert.equal(problems[0].reason, "too-long");
  assert.equal(problems[0].severity, "error");
  assert.equal(blockingSizeProblems(problems).length, 1);
});

test("the spouse's contact number is repaired on the same terms", () => {
  const problems = sizeProblem("customer", 20, "09171234567/09181234567");
  assert.equal(problems[0].label, "Spouse Contact No (If Married)");
  assert.equal(problems[0].reason, "multiple-values");
  assert.equal(problems[0].severity, "warning");
  assert.equal(problems[0].kept, "09171234567");
});

test("real rejections stay errors — only the repairable one is downgraded", () => {
  // The audit that matters: a reason is an error if and only if the server
  // refuses the row. Getting this backwards in either direction is a bug.
  const cases: [ImportShape, number, string, string][] = [
    ["customer", 1, "x".repeat(256), "too-long"],
    ["loans", 1, "x".repeat(51), "too-long"],
    ["share_capital", 0, "7".repeat(51), "too-long"],
    ["customer", 4, "a".repeat(21), "too-long"],
  ];
  for (const [shape, index, value, reason] of cases) {
    const problems = sizeProblem(shape, index, value);
    assert.equal(problems[0].reason, reason, value);
    assert.equal(problems[0].severity, "error", `${reason} must block the row`);
    assert.equal(blockingSizeProblems(problems).length, 1, reason);
  }
});

test("blockingSizeProblems keeps errors and drops warnings from a mixed row", () => {
  const messy = [...CUSTOMER_ROW];
  messy[8] = "09171234567/09181234567";
  messy[1] = "x".repeat(256);
  const problems = fieldSizeProblems(normaliseRow(messy, "customer"), "customer");
  assert.equal(problems.length, 2);
  assert.deepEqual(
    blockingSizeProblems(problems).map((p) => p.label),
    ["Last Name"],
  );
});

test("a long Purpose, Loan Product or Other Fee Detail is never a size refusal: the server cuts them, and the loan rules say so", () => {
  // `./import-loan-fields` warns past 500 and 255; nothing here refuses the row.
  assert.deepEqual(sizeProblem("loans", 7, "x".repeat(1000)), []);
  assert.deepEqual(sizeProblem("loans", 8, "x".repeat(1000)), []);
  assert.deepEqual(sizeProblem("loans", 16, "x".repeat(1000)), []);
  for (const key of ["purpose", "loan_product", "other_fee_detail"]) {
    assert.equal(column("loans", key).maxLength, undefined, key);
  }
});

test("an Account No. in either file, and a Loan No., are refused past their 50-character columns, never cut", () => {
  const fifty = "x".repeat(50);
  for (const [shape, index, label] of [["customer", 0, "Account No."], ["loans", 0, "Account No."], ["loans", 1, "Loan No."]] as const) {
    assert.deepEqual(sizeProblem(shape, index, fifty), [], `${shape} ${label}: 50`);
    assert.deepEqual(
      sizeProblem(shape, index, `${fifty}x`).map((p) => [p.label, p.reason, p.severity, p.limit]),
      [[label, "too-long", "error", 50]],
      `${shape} ${label}: 51`,
    );
  }
  // Twenty-one characters, which the server cut to 20 before round 4, read whole.
  assert.deepEqual(sizeProblem("loans", 1, "LN-2023-ABCDEFGHIJKLM"), []);
});

test("no amount is a size question: every file's amounts are read as the server reads them", () => {
  // `./import-server-values`, through the members, loans and share capital
  // files' own rules (`./import-member-fields`, `./import-loan-fields`,
  // `./import-share-capital`), in the server's words.
  for (const written of ["-500", "(500)", "1234.500", "$500", "P500", "N/A", "3%", "10000000000"]) {
    for (const [shape, index] of [["customer", 15], ["customer", 16], ["loans", 2], ["loans", 4], ["share_capital", 4]] as const) {
      assert.deepEqual(sizeProblem(shape, index, written), [], `${shape} ${index} "${written}"`);
    }
  }
});

test("names and addresses are varchar(255)", () => {
  assert.deepEqual(sizeProblem("customer", 1, "x".repeat(255)), []);
  assert.equal(sizeProblem("customer", 1, "x".repeat(256))[0].label, "Last Name");
  assert.equal(sizeProblem("customer", 12, "x".repeat(256))[0].label, "City/Municipality");
});

test("Term in Months is the loan rules' question, not a size one", () => {
  // `./import-loan-fields` reads it as the server does: 1 to 120 whole months.
  for (const written of ["12", "121", "12.5", "₱12"]) {
    assert.deepEqual(sizeProblem("loans", 9, written), [], written);
  }
});

test("a blank cell is a required-field question, not a size one", () => {
  assert.deepEqual(sizeProblem("customer", 16, ""), [], "blank Pledge Amt is optional");
  assert.deepEqual(sizeProblem("loans", 14, ""), [], "blank Processing Fee is optional");
});

test("an unknown value is REPORTED with its options, never silently dropped", () => {
  const civil = column("customer", "civil_status");
  const result = resolveEnumValue(civil, "It's Complicated");
  assert.deepEqual(result, {
    ok: false,
    raw: "It's Complicated",
    options: CIVIL_STATUS_OPTIONS,
  });

  const frequency = column("loans", "payment_frequency");
  assert.equal(resolveEnumValue(frequency, "Quarterly").ok, false);
  assert.equal(resolveEnumValue(frequency, "Annually").ok, false);
});

test("a blank enum cell is a required-field question, not a vocabulary one", () => {
  assert.deepEqual(resolveEnumValue(column("customer", "civil_status"), "  "), {
    ok: true, value: "", label: "",
  });
});

test("resolveRowEnums canonicalises the whole row and lists what it could not", () => {
  const messy = [...CUSTOMER_ROW];
  messy[6] = "F";
  messy[7] = "MARRIED";
  messy[4] = "JR";
  const { row, unknown } = resolveRowEnums(normaliseRow(messy, "customer"), "customer");
  assert.equal(row.gender, "female");
  assert.equal(row.civil_status, "married");
  assert.equal(row.suffix, "Jr.");
  assert.deepEqual(unknown, []);
  assert.equal(row.last_name, "Dela Cruz", "non-enum fields pass through untouched");
});

test("an unresolvable cell keeps its original text AND is reported", () => {
  // Blanking it would be the silent drop this module exists to avoid: the row
  // would import looking complete, with one field simply gone.
  const messy = [...CUSTOMER_ROW];
  messy[7] = "Live-in";
  const { row, unknown } = resolveRowEnums(normaliseRow(messy, "customer"), "customer");
  assert.equal(row.civil_status, "Live-in");
  assert.equal(unknown.length, 1);
  assert.equal(unknown[0].key, "civil_status");
  assert.equal(unknown[0].label, "Civil Status");
  assert.equal(unknown[0].raw, "Live-in");
  assert.deepEqual(unknown[0].options, CIVIL_STATUS_OPTIONS);
});

test("an unrecognised gender or civil status is imported blank; any other closed vocabulary refuses the row", () => {
  const member = [...CUSTOMER_ROW, "", "", "Premium", ""];
  member[6] = "Other";
  member[7] = "Live-in";
  assert.deepEqual(
    resolveRowEnums(normaliseRow(member, "customer"), "customer").unknown.map((value) => [value.label, value.raw, value.refused]),
    [["Gender", "Other", false], ["Civil Status", "Live-in", false], ["Member Type", "Premium", true]],
  );

  const loan = [...LOANS_ROW];
  loan[10] = "Quarterly";
  loan[11] = "Compound";
  assert.deepEqual(
    resolveRowEnums(normaliseRow(loan, "loans"), "loans").unknown.map((value) => [value.label, value.refused]),
    [["Payment Frequency", true], ["Interest Type", true]],
  );
});

/**
 * The server's own words for a member's Gender and Civil Status, as
 * `CustomerRowNormalizer::GENDER_MAP` and `::CIVIL_STATUS_MAP` hold them
 * (lendyph-backend, app/Services/CsvImport/CustomerRowNormalizer.php), keyed
 * after `CsvImportSchema::normalizeLabel()`. Written out here, not imported,
 * so the client's copy is checked against the server's list.
 */
const SERVER_GENDER_MAP: Record<string, string> = {
  male: "male",
  m: "male",
  lalaki: "male",
  lalake: "male",
  female: "female",
  f: "female",
  babae: "female",
};
const SERVER_CIVIL_STATUS_MAP: Record<string, string> = {
  single: "single",
  married: "married",
  widowed: "widowed",
  widow: "widowed",
  widower: "widowed",
  separated: "separated",
  "legally separated": "separated",
  divorced: "divorced",
};

test("every word the server reads for a member's gender and civil status resolves to the server's value", () => {
  for (const [key, map] of [["gender", SERVER_GENDER_MAP], ["civil_status", SERVER_CIVIL_STATUS_MAP]] as const) {
    const vocabulary = column("customer", key);
    for (const [word, value] of Object.entries(map)) {
      // As the server keys a cell: any case, punctuation between words or at the ends.
      for (const spelling of [word, word.toUpperCase(), ` ${word}. `, word.replace(" ", "-")]) {
        const result = resolveEnumValue(vocabulary, spelling);
        assert.equal(result.ok ? result.value : null, value, `${key} "${spelling}"`);
      }
    }
  }
});

test("Lalaki and Lalake read as Male and Babae as Female, in any case, as the server reads them", () => {
  const gender = column("customer", "gender");
  for (const spelling of ["Lalaki", "LALAKI", "lalake", " Lalake. "]) {
    assert.deepEqual(resolveEnumValue(gender, spelling), { ok: true, value: "male", label: "Male" }, spelling);
  }
  for (const spelling of ["Babae", "BABAE", " babae "]) {
    assert.deepEqual(resolveEnumValue(gender, spelling), { ok: true, value: "female", label: "Female" }, spelling);
  }
});

test("a member's gender or civil status the server doesn't read isn't read here either", () => {
  const gender = column("customer", "gender");
  for (const spelling of ["Lalakii", "Babai", "Fe male", "Ma-le", "La-laki"]) {
    assert.equal(resolveEnumValue(gender, spelling).ok, false, spelling);
  }
  const civil = column("customer", "civil_status");
  for (const spelling of ["Maried", "Marrried", "Seperated", "Divorce", "Annulled", "LegallySeparated", "Widow er"]) {
    assert.equal(resolveEnumValue(civil, spelling).ok, false, spelling);
  }
});

test("Legally Separated reads as Separated, as the server reads it", () => {
  const civil = column("customer", "civil_status");
  for (const spelling of ["Legally Separated", "LEGALLY-SEPARATED", " legally separated "]) {
    assert.deepEqual(resolveEnumValue(civil, spelling), { ok: true, value: "separated", label: "Separated" }, spelling);
  }
});

test("the loans sheet's enums resolve on a real row", () => {
  const { row, unknown } = resolveRowEnums(normaliseRow(LOANS_ROW, "loans"), "loans");
  assert.deepEqual(unknown, []);
  assert.equal(row.payment_frequency, "monthly");
  assert.equal(row.interest_type, "diminishing");
});

/**
 * The server's own words for a loan's Payment Frequency and Interest Type
 * (lendyph-backend, app/Services/CsvImport/LoanRowNormalizer.php):
 * `frequencyMap()`, which keys each `LoanFrequency` with its words spaced and
 * run together, and `INTEREST_TYPE_MAP`, keyed after
 * `CsvImportSchema::normalizeLabel()`. Written out here, not imported, so the
 * client's copy is checked against the server's list (finish run round 4).
 */
const SERVER_FREQUENCY_MAP: Record<string, string> = {
  daily: "daily",
  weekly: "weekly",
  "bi weekly": "bi_weekly",
  biweekly: "bi_weekly",
  "semi monthly": "semi_monthly",
  semimonthly: "semi_monthly",
  monthly: "monthly",
  "upon maturity": "upon_maturity",
  uponmaturity: "upon_maturity",
};
const SERVER_INTEREST_TYPE_MAP: Record<string, string> = {
  "straight fixed": "straight",
  straight: "straight",
  fixed: "straight",
  flat: "straight",
  diminishing: "diminishing",
  "diminishing balance": "diminishing",
  "upon maturity": "upon_maturity",
};

test("every word the server reads for a loan's payment frequency and interest type resolves to the server's value", () => {
  for (const [key, map] of [["payment_frequency", SERVER_FREQUENCY_MAP], ["interest_type", SERVER_INTEREST_TYPE_MAP]] as const) {
    const vocabulary = column("loans", key);
    for (const [word, value] of Object.entries(map)) {
      // As the server keys a cell: any case, punctuation between words or at the ends.
      for (const spelling of [word, word.toUpperCase(), ` ${word}. `, word.replace(" ", "-"), word.replace(" ", "_")]) {
        const result = resolveEnumValue(vocabulary, spelling);
        assert.equal(result.ok ? result.value : null, value, `${key} "${spelling}"`);
      }
    }
  }
  assert.deepEqual(resolveEnumValue(column("loans", "interest_type"), "Straight (Fixed)"), {
    ok: true, value: "straight", label: "Straight (Fixed)",
  });
  assert.deepEqual(resolveEnumValue(column("loans", "interest_type"), "Upon Maturity"), {
    ok: true, value: "upon_maturity", label: "Upon Maturity",
  });
});

test("a payment frequency or interest type the server doesn't read refuses the row here too", () => {
  const frequency = column("loans", "payment_frequency");
  for (const spelling of ["Fortnightly", "Twice monthly", "Bullet", "Balloon", "Lump sum", "Maturity", "Quarterly", "Semi Monthy", "Bi-Week"]) {
    assert.equal(resolveEnumValue(frequency, spelling).ok, false, spelling);
  }
  const interest = column("loans", "interest_type");
  for (const spelling of ["Reducing", "Decreasing", "Add-on", "Fixed Rate", "StraightFixed", "Diminishing-Balance-Rate"]) {
    assert.equal(resolveEnumValue(interest, spelling).ok, false, spelling);
  }

  const loan = [...LOANS_ROW];
  loan[10] = "Fortnightly";
  loan[11] = "Reducing";
  assert.deepEqual(
    resolveRowEnums(normaliseRow(loan, "loans"), "loans").unknown.map((value) => [value.label, value.raw, value.refused]),
    [["Payment Frequency", "Fortnightly", true], ["Interest Type", "Reducing", true]],
  );
});

test("an unknown interest type names the three the import takes", () => {
  const result = resolveEnumValue(column("loans", "interest_type"), "Compound");
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.ok ? [] : result.options.map((option) => option.label),
    ["Straight (Fixed)", "Diminishing", "Upon Maturity"],
  );
});

// ── The share capital file (finish run round 2, decision 13) ───────────────

test("the share capital file is six columns, in the server's order", () => {
  assert.deepEqual(
    SHARE_CAPITAL_COLUMNS.map((column) => [column.key, column.label, column.required]),
    [
      ["account_no", "Account No. or Member ID", true],
      ["transaction_date", "Transaction Date", true],
      ["reference_number", "Reference Number", false],
      ["transaction_type", "Transaction Type", true],
      ["amount", "Amount", true],
      ["remarks", "Remarks", false],
    ],
  );
  assert.deepEqual(acceptedWidths("share_capital"), [6]);
  assert.equal(columnsFor("share_capital"), SHARE_CAPITAL_COLUMNS);
});

test("the transaction type is read in words, Contribution or Withdrawal, as the server reads it", () => {
  const column = SHARE_CAPITAL_COLUMNS.find((c) => c.key === "transaction_type");
  assert.ok(column);
  assert.deepEqual(TRANSACTION_TYPE_OPTIONS.map((option) => option.label), ["Contribution", "Withdrawal"]);

  for (const word of ["Contribution", "contribution", "Credit", "CR", "Share Capital Contribution"]) {
    assert.deepEqual(resolveEnumValue(column, word), { ok: true, value: "credit", label: "Contribution" }, word);
  }
  for (const word of ["Withdrawal", "DEBIT", "dr", "Share capital withdrawal"]) {
    assert.deepEqual(resolveEnumValue(column, word), { ok: true, value: "debit", label: "Withdrawal" }, word);
  }
  assert.equal(resolveEnumValue(column, "Dividend").ok, false);
});

test("the share capital file identifies itself, by its header or its rows", () => {
  const header = identifyShape(SHARE_CAPITAL_COLUMNS.map((c) => c.label));
  assert.equal(header.shape, "share_capital");
  assert.equal(header.basis, "header");

  const row = identifyShape(["2019-00101", "2026-01-15", "OR-1001", "Contribution", "1500.00", ""]);
  assert.equal(row.shape, "share_capital");
  assert.equal(row.basis, "content");
  assert.ok(row.shareCapitalScore > row.customerScore && row.shareCapitalScore > row.loansScore);

  // The other two files are still themselves.
  assert.equal(identifyShape(CUSTOMER_HEADER).shape, "customer");
  assert.equal(identifyShape(LOANS_HEADER).shape, "loans");
  assert.equal(identifyShape(CUSTOMER_ROW).shape, "customer");
  assert.equal(identifyShape(LOANS_ROW).shape, "loans");
});
