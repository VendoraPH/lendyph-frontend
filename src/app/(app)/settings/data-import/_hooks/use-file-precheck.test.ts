import assert from "node:assert/strict";
import test from "node:test";
import type { CsvRecord } from "@/lib/csv-parse";
import {
  ISO_DATE_FORMAT,
  ISSUE_LIST_CAP,
  checkRows,
  computeFindings,
  describeIsoDate,
  fileBlockers,
  inspectFile,
  sessionAnswers,
  type DateColumnFinding,
  type FileInspection,
} from "./use-file-precheck";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A complete, valid members file row. Mutate a copy to make one bad. */
const CUSTOMER: string[] = [
  "2019-00101",
  "Dela Cruz",
  "Maria",
  "Santos",
  "",
  "1985-03-12",
  "Female",
  "Married",
  "09171234567",
  "maria@example.com",
  "12 Rizal St",
  "Poblacion",
  "Tagum City",
  "Davao del Norte",
  "Market",
  "25000.00",
  "5000.00",
  "Jose",
  "Reyes",
  "Dela Cruz",
  "09181112222",
  "Driver",
];

/** A complete, valid Loans row. */
const LOAN: string[] = [
  "2019-00101",
  "2019-L-0001",
  "50000.00",
  "20000.00",
  "2.0000",
  "12000.00",
  "4800.00",
  "Business capital",
  "Regular Loan",
  "12",
  "Monthly",
  "Diminishing",
  "2025-01-15",
  "2026-01-15",
  "1000.00",
  "500.00",
  "",
  "",
];

function record(fields: readonly string[], line: number): CsvRecord {
  return { index: line - 1, line, fields: [...fields] };
}

function customerRows(rows: readonly (readonly string[])[]): CsvRecord[] {
  return rows.map((fields, i) => record(fields, i + 1));
}

const NO_DATES: DateColumnFinding[] = [];

const CUSTOMER_CONTEXT = {
  kind: "customers" as const,
  shape: "customer" as const,
  dates: NO_DATES,
  knownAccounts: null,
  expectedColumns: 22,
};

const LOANS_CONTEXT = {
  kind: "loans" as const,
  shape: "loans" as const,
  dates: NO_DATES,
  knownAccounts: null,
  expectedColumns: 18,
};

// ---------------------------------------------------------------------------
// Severity — a warning must never reach a failure total
// ---------------------------------------------------------------------------

test("a contact number holding two numbers is a warning, not a failure", () => {
  const row = [...CUSTOMER];
  row[8] = "09171234567/09181234567";

  const result = checkRows(customerRows([row]), CUSTOMER_CONTEXT);

  assert.equal(result.errorCount, 0, "the server repairs this; it must not count as an error");
  assert.equal(result.failingRows, 0, "the row imports, so it is not a failing row");
  assert.equal(result.warningCount, 1);
  assert.match(result.issues[0].message, /keeps 09171234567/);
  assert.match(result.issues[0].message, /drops 09181234567/);
});

test("a value the server rejects is an error, next to a value it repairs", () => {
  const row = [...CUSTOMER];
  row[8] = "09171234567/09181234567"; // repaired -> warning
  row[15] = "not-a-number"; // Monthly Income -> error

  const result = checkRows(customerRows([row]), CUSTOMER_CONTEXT);

  assert.equal(result.errorCount, 1);
  assert.equal(result.warningCount, 1);
  assert.equal(result.failingRows, 1);
});

test("a loan whose member is not in the customers file is a warning", () => {
  const row = [...LOAN];
  row[0] = "2020-00299";

  const result = checkRows(customerRows([row]), {
    ...LOANS_CONTEXT,
    knownAccounts: new Set(["2019-00101"]),
  });

  assert.equal(result.errorCount, 0, "the coop's self-registered members exist server-side");
  assert.equal(result.warningCount, 1);
  assert.equal(result.issues[0].category, "cross-file");
});

test("cross-file matching is skipped entirely when the customers file was not read", () => {
  const row = [...LOAN];
  row[0] = "2020-00299";

  const result = checkRows(customerRows([row]), LOANS_CONTEXT);

  assert.equal(result.warningCount, 0, "claiming a member is missing needs a file to be missing from");
});

// ---------------------------------------------------------------------------
// Row-level checks
// ---------------------------------------------------------------------------

test("a blank Account No. fails the row and names the column", () => {
  const row = [...CUSTOMER];
  row[0] = "";

  const result = checkRows(customerRows([row]), CUSTOMER_CONTEXT);

  assert.equal(result.failingRows, 1);
  assert.equal(result.issues[0].severity, "error");
  assert.equal(result.issues[0].category, "required");
  assert.equal(result.issues[0].column, "Account No.");
  assert.equal(result.issues[0].message, "Account No. is blank, and this row cannot be imported without it.");
});

// ---------------------------------------------------------------------------
// Blank and unrecognised member cells: what the server refuses (round 3)
// ---------------------------------------------------------------------------

test("of the workbook's required cells, only a blank Account No., Last Name or First Name fails a member's row", () => {
  const refused: Array<[number, string]> = [[0, "Account No."], [1, "Last Name"], [2, "First Name"]];
  const imported: Array<[number, string]> = [
    [5, "Birthdate"], [6, "Gender"], [7, "Civil Status"], [8, "Contact Number"],
    [9, "email"], [11, "Barangay"], [12, "City/Municipality"], [13, "Province"],
  ];

  for (const [index, label] of refused) {
    const row = [...CUSTOMER];
    row[index] = "";
    const result = checkRows(customerRows([row]), CUSTOMER_CONTEXT);
    assert.deepEqual(
      result.issues.map((issue) => [issue.column, issue.severity, issue.message]),
      [[label, "error", `${label} is blank, and this row cannot be imported without it.`]],
      label,
    );
    assert.equal(result.failingRows, 1, label);
  }

  for (const [index, label] of imported) {
    const row = [...CUSTOMER];
    row[index] = "";
    const result = checkRows(customerRows([row]), CUSTOMER_CONTEXT);
    assert.deepEqual(
      result.issues.map((issue) => [issue.column, issue.severity, issue.category, issue.message]),
      [[label, "warning", "required", `${label} is blank. The member will be imported without it; add it later on their page.`]],
      label,
    );
    assert.equal(result.errorCount, 0, label);
    assert.equal(result.failingRows, 0, label);
  }
});

test("a married member with a blank spouse name or contact number warns, and the row imports", () => {
  const row = [...CUSTOMER];
  row[17] = ""; // Spouse FName
  row[19] = ""; // Spouse LName
  row[20] = ""; // Spouse Contact No

  const result = checkRows(customerRows([row]), CUSTOMER_CONTEXT);

  assert.equal(result.errorCount, 0);
  assert.equal(result.failingRows, 0);
  assert.deepEqual(
    result.issues.map((issue) => [issue.column, issue.severity, issue.message]),
    ["Spouse FName (If Married)", "Spouse LName (If Married)", "Spouse Contact No (If Married)"].map((label) => [
      label,
      "warning",
      `${label} is blank. The member will be imported without it; add it later on their page.`,
    ]),
  );
});

test("a row of the wrong width is reported once, as a whole-row problem", () => {
  const result = checkRows(customerRows([CUSTOMER.slice(0, 21)]), CUSTOMER_CONTEXT);

  const columnIssues = result.issues.filter((issue) => issue.category === "columns");
  assert.equal(columnIssues.length, 1);
  assert.equal(columnIssues[0].column, null);
  assert.match(columnIssues[0].message, /21 columns/);
});

test("an unrecognised gender or civil status warns that it will be imported blank, and quotes the options", () => {
  const gender = [...CUSTOMER];
  gender[6] = "Lalake";
  const civil = [...CUSTOMER];
  civil[0] = "2019-00102";
  civil[7] = "Live-in";

  const result = checkRows(customerRows([gender, civil]), CUSTOMER_CONTEXT);

  assert.equal(result.errorCount, 0);
  assert.equal(result.failingRows, 0);
  assert.deepEqual(result.issues.map((issue) => [issue.column, issue.severity, issue.category, issue.message]), [
    [
      "Gender",
      "warning",
      "value",
      'Gender "Lalake" isn\'t one the import recognises, so it will be imported blank; add it later on the member\'s page. Expected one of: Male, Female.',
    ],
    [
      "Civil Status",
      "warning",
      "value",
      'Civil Status "Live-in" isn\'t one the import recognises, so it will be imported blank; add it later on the member\'s page. Expected one of: Single, Married, Widowed, Separated, Divorced.',
    ],
  ]);
});

test("a civil status the server reads, Legally Separated, raises nothing", () => {
  const row = [...CUSTOMER];
  row[7] = "Legally Separated";

  assert.deepEqual(checkRows(customerRows([row]), CUSTOMER_CONTEXT).issues, []);
});

test("a duplicate identifier is a warning that points at the first row", () => {
  const result = checkRows(customerRows([CUSTOMER, CUSTOMER]), CUSTOMER_CONTEXT);

  const dupes = result.issues.filter((issue) => issue.category === "duplicate");
  assert.equal(dupes.length, 1);
  assert.equal(dupes[0].line, 2);
  assert.match(dupes[0].message, /already on line 1/);
  assert.equal(result.errorCount, 0);
});

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const BIRTHDATE_DMY: DateColumnFinding = {
  key: "birthdate",
  label: "Birthdate",
  inference: { status: "resolved", order: "dmy", evidence: "25/12/1990", stats: {} as never },
  order: "dmy",
  chosen: false,
  blocked: false,
};

test("dates are checked against the settled order, and an impossible one fails", () => {
  const row = [...CUSTOMER];
  row[5] = "13/13/1990";

  const result = checkRows(customerRows([row]), { ...CUSTOMER_CONTEXT, dates: [BIRTHDATE_DMY] });

  const dates = result.issues.filter((issue) => issue.category === "date");
  assert.equal(dates.length, 1);
  assert.match(dates[0].message, /not a real date read day-first/);
});

test("an ambiguous column with no choice yet produces no row issues at all", () => {
  const pending: DateColumnFinding = { ...BIRTHDATE_DMY, order: undefined, blocked: false };
  const row = [...CUSTOMER];
  row[5] = "03/04/1975";

  const result = checkRows(customerRows([row]), { ...CUSTOMER_CONTEXT, dates: [pending] });

  assert.equal(
    result.issues.filter((issue) => issue.category === "date").length,
    0,
    "judging a cell under a guessed order is the mistake this screen exists to prevent",
  );
});

test("a blocked column is not judged row by row — it is one file-level blocker", () => {
  const blocked: DateColumnFinding = { ...BIRTHDATE_DMY, order: undefined, blocked: true };
  const rows = customerRows([CUSTOMER, CUSTOMER, CUSTOMER]);

  const result = checkRows(rows, { ...CUSTOMER_CONTEXT, dates: [blocked] });

  assert.equal(result.issues.filter((issue) => issue.category === "date").length, 0);
});

// ---------------------------------------------------------------------------
// The four Member Profile columns, and the two layouts
// ---------------------------------------------------------------------------

/** The same member in today's 26-column layout: the workbook's 22, then four. */
const CUSTOMER_26: string[] = [...CUSTOMER, "2012-06-01", "2010-03-15", "Associate", "BC-0007"];

const NEW_COLUMN_AT = { date_hired: 22, membership_date: 23, member_type: 24, membership_number: 25 } as const;

function memberRow(overrides: Partial<Record<keyof typeof NEW_COLUMN_AT, string>>, account = "2019-00101"): string[] {
  const row = [...CUSTOMER_26];
  row[0] = account;
  for (const [key, value] of Object.entries(overrides)) {
    row[NEW_COLUMN_AT[key as keyof typeof NEW_COLUMN_AT]] = value ?? "";
  }
  return row;
}

function isoColumn(key: string, label: string): DateColumnFinding {
  return {
    key,
    label,
    inference: { status: "resolved", order: null, evidence: null, stats: {} as never },
    order: null,
    chosen: false,
    blocked: false,
  };
}

const CURRENT_CONTEXT = {
  ...CUSTOMER_CONTEXT,
  expectedColumns: 26,
  dates: [
    isoColumn("birthdate", "Birthdate"),
    isoColumn("date_hired", "Date Hired"),
    isoColumn("membership_date", "Membership Date"),
  ],
  today: "2026-11-24",
};

test("good values in the four new columns pass the pre-check", () => {
  const rows = customerRows([
    CUSTOMER_26,
    // The birthdate itself is not before the birthdate, and today is not after today.
    memberRow({ date_hired: "1985-03-12", membership_date: "2026-11-24", member_type: "REGULAR", membership_number: "2019-00102" }, "2019-00102"),
    // Every new column blank: not set.
    memberRow({ date_hired: "", membership_date: "", member_type: "", membership_number: "" }, "2019-00103"),
  ]);

  const result = checkRows(rows, CURRENT_CONTEXT);

  assert.equal(result.errorCount, 0, result.issues.map((issue) => issue.message).join(" | "));
  assert.equal(result.warningCount, 0);
});

test("a bad value in a new column fails the row, in words", () => {
  const cases: Array<[Partial<Record<keyof typeof NEW_COLUMN_AT, string>>, string, RegExp]> = [
    [{ date_hired: "2026-11-25" }, "Date Hired", /after today, and a date hired can't be in the future/],
    [{ date_hired: "1980-01-01" }, "Date Hired", /before this member's birthdate/],
    [{ date_hired: "1900-01-01" }, "Date Hired", /not after 1 January 1900/],
    [{ date_hired: "last year" }, "Date Hired", /is not a date/],
    [{ membership_date: "2026-11-25" }, "Membership Date", /after today, and a membership date can't be in the future/],
    [{ member_type: "Premium" }, "Member Type", /Expected one of: Regular, Associate/],
    [{ membership_number: "brw-000123" }, "Membership Number", /starts like a member code \(BRW\)/],
    // Look-alikes of a member code are refused the same way.
    [{ membership_number: "BRW000123" }, "Membership Number", /starts like a member code \(BRW\)/],
    [{ membership_number: "BRW-00O123" }, "Membership Number", /starts like a member code \(BRW\)/],
    [{ membership_number: "NIÑO-01" }, "Membership Number", /plain letters, numbers and punctuation/],
    [{ membership_number: "7".repeat(31) }, "Membership Number", /31 characters; this field holds 30/],
    // A spreadsheet placeholder would become the member's sign-in number.
    [{ membership_number: "-" }, "Membership Number", /has no digits, so it reads as a spreadsheet placeholder/],
    [{ membership_number: "N/A" }, "Membership Number", /has no digits, so it reads as a spreadsheet placeholder/],
    [{ membership_number: "0" }, "Membership Number", /is nothing but zeros/],
    [{ membership_number: "00-00" }, "Membership Number", /is nothing but zeros/],
  ];

  for (const [override, label, words] of cases) {
    const result = checkRows(customerRows([memberRow(override)]), CURRENT_CONTEXT);
    const summary = `${JSON.stringify(override)}: ${result.issues.map((issue) => issue.message).join(" | ")}`;

    assert.equal(result.errorCount, 1, summary);
    assert.equal(result.failingRows, 1, summary);
    assert.equal(result.issues[0].column, label, summary);
    assert.match(result.issues[0].message, words, summary);
    assert.doesNotMatch(result.issues[0].message, /\b[a-z]+_[a-z_]+\b/, `${summary}: words, never field keys`);
  }
});

test("an unknown Member Type still fails the row: the server refuses it, unlike a gender", () => {
  const result = checkRows(customerRows([memberRow({ member_type: "Premium" })]), CURRENT_CONTEXT);

  assert.equal(result.failingRows, 1);
  assert.deepEqual(result.issues.map((issue) => [issue.column, issue.severity, issue.message]), [
    ["Member Type", "error", '"Premium" is not a value Member Type accepts. Expected one of: Regular, Associate.'],
  ]);
});

test("a real membership number may hold zeros, and letters other than a member code's", () => {
  const rows = customerRows(
    ["BC-000", "A1", "10", "BR-0007"].map((number, i) => memberRow({ membership_number: number }, `2019-0020${i}`)),
  );

  const result = checkRows(rows, CURRENT_CONTEXT);

  assert.equal(result.errorCount, 0, result.issues.map((issue) => issue.message).join(" | "));
});

test("spaces in a membership number are a warning: it is stored without them", () => {
  const result = checkRows(customerRows([memberRow({ membership_number: "bc 0007" })]), CURRENT_CONTEXT);

  assert.equal(result.errorCount, 0);
  assert.equal(result.warningCount, 1);
  assert.match(result.issues[0].message, /stored as BC0007/);
});

test("a membership number used twice in one file fails the second row", () => {
  const rows = customerRows([
    memberRow({ membership_number: "BC-0100" }, "2019-00101"),
    memberRow({ membership_number: "bc-0100" }, "2019-00102"),
  ]);

  const result = checkRows(rows, CURRENT_CONTEXT);

  assert.equal(result.errorCount, 1);
  assert.equal(result.issues[0].line, 2);
  assert.equal(result.issues[0].column, "Membership Number");
  assert.match(result.issues[0].message, /BC-0100 is already on line 1/);
});

test("without permission to edit members, a filled membership column fails the row", () => {
  const rows = customerRows([
    memberRow({}, "2019-00101"),
    // Date Hired is an ordinary member field; only the membership columns need it.
    memberRow({ membership_date: "", member_type: "", membership_number: "" }, "2019-00102"),
  ]);

  const result = checkRows(rows, { ...CURRENT_CONTEXT, membershipAllowed: false });

  assert.equal(result.errorCount, 1);
  assert.equal(result.failingRows, 1);
  assert.equal(result.issues[0].line, 1);
  assert.match(result.issues[0].message, /Only staff who can edit members can import membership details/);
});

test("each layout holds its rows to its own width", () => {
  // An old file's row that grew four cells is not a row of today's layout.
  const grown = checkRows(customerRows([CUSTOMER_26]), CUSTOMER_CONTEXT);
  const grownIssue = grown.issues.find((issue) => issue.category === "columns");
  assert.ok(grownIssue);
  assert.match(grownIssue.message, /26 columns/);
  assert.match(grownIssue.message, /earlier 22-column layout/);

  const short = checkRows(customerRows([CUSTOMER]), CURRENT_CONTEXT);
  const shortIssue = short.issues.find((issue) => issue.category === "columns");
  assert.ok(shortIssue);
  assert.match(shortIssue.message, /22 columns; the members file needs 26/);
});

// ---------------------------------------------------------------------------
// Truncation
// ---------------------------------------------------------------------------

test("capping the issue LIST never caps the issue COUNT", () => {
  const bad = [...CUSTOMER];
  bad[1] = ""; // Last Name blank on every row: the server refuses it
  const rows = customerRows(Array.from({ length: 40 }, () => bad));

  const result = checkRows(rows, CUSTOMER_CONTEXT, 10);

  assert.equal(result.issues.length, 10);
  assert.equal(result.issuesTruncated, true);
  assert.equal(result.errorCount, 40, "the count is what the summary shows; it must be complete");
  assert.equal(result.failingRows, 40);
});

test("the cap is only reached by files that earn it", () => {
  const result = checkRows(customerRows([CUSTOMER]), CUSTOMER_CONTEXT);
  assert.equal(result.issuesTruncated, false);
  assert.ok(ISSUE_LIST_CAP > 0);
});

// ---------------------------------------------------------------------------
// Whole-file blockers
// ---------------------------------------------------------------------------

function inspectionStub(overrides: Partial<FileInspection> = {}): FileInspection {
  return {
    kind: "customers",
    shape: "customer",
    label: "Members file",
    fileName: "customers.csv",
    sizeBytes: 100,
    delimiter: ",",
    delimiterLabel: "comma",
    delimiterDetected: true,
    delimiterRows: 5,
    notices: [],
    records: customerRows([CUSTOMER]),
    expectedColumns: 22,
    header: null,
    headerFields: null,
    slot: { shape: "customer", customerScore: 1, loansScore: 0, shareCapitalScore: 0, basis: "content" },
    widths: [{ columns: 22, rows: 1 }],
    ...overrides,
  };
}

test("a conflicted date column blocks the file and quotes both proofs", () => {
  const conflicted: DateColumnFinding = {
    key: "birthdate",
    label: "Birthdate",
    inference: {
      status: "conflicted",
      dmyEvidence: "25/12/1990",
      mdyEvidence: "12/25/1990",
      stats: {} as never,
    },
    order: undefined,
    chosen: false,
    blocked: true,
  };

  const blockers = fileBlockers(inspectionStub(), customerRows([CUSTOMER]), [conflicted]);

  assert.equal(blockers.length, 1);
  assert.match(blockers[0], /25\/12\/1990 can only be day-first/);
  assert.match(blockers[0], /12\/25\/1990 can only be month-first/);
});

test("the loans file dropped into the customers slot is a blocker, not a row error", () => {
  const inspection = inspectionStub({
    slot: { shape: "loans", customerScore: 0.1, loansScore: 0.9, shareCapitalScore: 0, basis: "content" },
  });

  const blockers = fileBlockers(inspection, customerRows([CUSTOMER]), NO_DATES);

  assert.equal(blockers.length, 1);
  assert.match(blockers[0], /looks like the loans file, but it was chosen as the members file/);
});

test("the share capital file dropped into the members slot is a blocker, not a row error", () => {
  const inspection = inspectionStub({
    slot: { shape: "share_capital", customerScore: 0.1, loansScore: 0.1, shareCapitalScore: 0.9, basis: "content" },
  });

  const blockers = fileBlockers(inspection, customerRows([CUSTOMER]), NO_DATES);

  assert.equal(blockers.length, 1);
  assert.match(blockers[0], /looks like the share capital file, but it was chosen as the members file/);
});

test("a file whose rows are systematically the wrong width is blocked once", () => {
  const inspection = inspectionStub({ widths: [{ columns: 18, rows: 400 }] });

  const blockers = fileBlockers(inspection, customerRows([CUSTOMER]), NO_DATES);

  assert.equal(blockers.length, 1);
  assert.match(blockers[0], /Most rows have 18 columns/);
});

/** A members file from records, comma-joined (no cell here holds a comma). */
function membersFile(records: readonly (readonly string[])[]): File {
  return new File([records.map((fields) => fields.join(",")).join("\r\n") + "\r\n"], "members.csv", {
    type: "text/csv",
  });
}

const OLD_LABELS = [
  "Account No.", "Last Name", "First Name", "Middle Name", "Suffix", "Birthdate", "Gender",
  "Civil Status", "Contact Number", "email", "Street Address", "Barangay", "City/Municipality",
  "Province", "Employer/Business Name", "Monthly Income", "Pledge Amt(If Applicable)",
  "Spouse FName (If Married)", "Spouse MName (If Married)", "Spouse LName (If Married)",
  "Spouse Contact No (If Married)", "Spouse Occupation (If Married)",
];

test("a 22-column header over 26-column rows is caught, as the server holds a header to the rows' width", async () => {
  const inspection = await inspectFile("customers", membersFile([
    OLD_LABELS,
    memberRow({}, "2019-00101"),
    memberRow({}, "2019-00102"),
  ]));

  assert.equal(inspection.expectedColumns, 26);
  assert.equal(inspection.header?.isHeader, true, "it is still the header row, and is not imported as a member");

  const findings = computeFindings({ customers: inspection }, {}, {}).customers;
  assert.ok(findings);
  assert.equal(findings.totalRows, 2);
  assert.deepEqual(findings.blockers, [
    "Members file (members.csv): Row 1 is the header, but it leaves 4 columns unnamed: Date Hired, Membership Date, Member Type and Membership Number. The import holds the header to every column the rows have, so it would refuse this file. Add the missing labels; the members template has them all.",
  ]);
});

test("a full header over rows in the earlier layout is read against those rows' 22 columns", async () => {
  const fullHeader = [...OLD_LABELS, "Date Hired", "Membership Date", "Member Type", "Membership Number"];
  const inspection = await inspectFile("customers", membersFile([fullHeader, CUSTOMER, ["2019-00102", ...CUSTOMER.slice(1)]]));

  assert.equal(inspection.expectedColumns, 22);
  assert.equal(inspection.header?.isHeader, true);
  assert.deepEqual(inspection.header?.mismatched, []);

  const findings = computeFindings({ customers: inspection }, {}, {}).customers;
  assert.deepEqual(findings?.blockers, []);
  assert.equal(findings?.errorCount, 0);
});

test("a refusal names the file it is about, and an empty loans file says it can be left out", async () => {
  const loans = new File(
    ["Account No.,Loan No.,Loan Amount,Loan Balance,Interest Rate,Interest Amount,Interest Balance,Purpose,Loan Product,Term in Months,Payment Frequency,Interest Type,Date Released,Maturity Date,Processing Fee,Service Fee,Other Fee Detail,Other Fee Amount\r\n"],
    "loans.csv",
    { type: "text/csv" },
  );
  const inspection = await inspectFile("loans", loans);

  const findings = computeFindings({ loans: inspection }, {}, {}).loans;

  assert.deepEqual(findings?.blockers, [
    "Loans file (loans.csv): The only row in this file is the header row, so there is nothing to import. The loans file is optional: leave it out when there are no loans to bring over.",
  ]);
});

test("a file in the earlier layout lists only the date columns it has", () => {
  const earlier = computeFindings({ customers: inspectionStub() }, {}, {}).customers;
  assert.deepEqual(earlier?.dates.map((date) => date.key), ["birthdate"], "Date Hired and Membership Date are not in a 22-column file");

  const current = computeFindings(
    { customers: inspectionStub({ records: customerRows([CUSTOMER_26]), expectedColumns: 26, widths: [{ columns: 26, rows: 1 }] }) },
    {},
    {},
  ).customers;
  assert.deepEqual(current?.dates.map((date) => date.key), ["birthdate", "date_hired", "membership_date"]);
});

test("a date column of one unreadable value says 1 value, not 1 values", () => {
  const unusable: DateColumnFinding = {
    key: "birthdate",
    label: "Birthdate",
    inference: {
      status: "unusable",
      stats: {
        total: 1, blank: 0, iso: 0, pair: 0, serial: 0, shortYear: 0, invalid: 0, unrecognised: 1,
        shortYearSamples: [], invalidSamples: [], unrecognisedSamples: ["soon"],
      } as never,
    },
    order: undefined,
    chosen: false,
    blocked: true,
  };

  const [blocker] = fileBlockers(inspectionStub(), customerRows([CUSTOMER]), [unusable]);

  assert.match(blocker, /Of 1 value, 1 is not a date at all \(soon\)\./);
});

test("a members file at neither layout's width is blocked, and the blocker names both", () => {
  const inspection = inspectionStub({ widths: [{ columns: 24, rows: 400 }], expectedColumns: 26 });

  const blockers = fileBlockers(inspection, customerRows([CUSTOMER]), NO_DATES);

  assert.equal(blockers.length, 1);
  assert.match(blockers[0], /Most rows have 24 columns, but the members file needs 26, or 22 in the earlier layout/);
});

test("an unbalanced quote is carried through as a blocker, in the reader's own words", () => {
  const inspection = inspectionStub({
    notices: [{ code: "unterminated-quote", severity: "error", message: "A row opens a quote." }],
  });

  const blockers = fileBlockers(inspection, customerRows([CUSTOMER]), NO_DATES);

  assert.deepEqual(blockers, ["A row opens a quote."]);
});

test("a bad encoding is NOT a blocker — the server converts the original bytes", () => {
  const inspection = inspectionStub({
    notices: [{ code: "not-utf8", severity: "warning", message: "5 characters could not be read." }],
  });

  assert.deepEqual(fileBlockers(inspection, customerRows([CUSTOMER]), NO_DATES), []);
});

// ---------------------------------------------------------------------------
// computeFindings — the count on the heading is the whole file
// ---------------------------------------------------------------------------

test("the row total is the complete parse even when checks stop at the ceiling", () => {
  const rows = customerRows(Array.from({ length: 25 }, () => CUSTOMER));
  const findings = computeFindings({ customers: inspectionStub({ records: rows }) }, {}, {}, 10);

  assert.equal(findings.customers?.totalRows, 25);
  assert.equal(findings.customers?.checkedRows, 10);
  assert.equal(findings.customers?.rowsNotChecked, 15);
});

test("a members file with only these warnings isn't counted as failing, and nothing holds it up", () => {
  const changes: Array<Record<number, string>> = [
    { 0: "2019-00201", 5: "" }, // Birthdate blank
    { 0: "2019-00202", 6: "Lalake" }, // a gender the server doesn't recognise
    { 0: "2019-00203", 17: "", 19: "" }, // married, spouse names blank
    { 0: "2019-00204", 9: "", 13: "" }, // email and Province blank
  ];
  const rows = changes.map((change) => CUSTOMER.map((cell, index) => change[index] ?? cell));

  const findings = computeFindings(
    { customers: inspectionStub({ records: customerRows(rows), widths: [{ columns: 22, rows: rows.length }] }) },
    {},
    {},
  ).customers;

  assert.ok(findings);
  assert.equal(findings.errorCount, 0, findings.issues.map((issue) => issue.message).join(" | "));
  assert.equal(findings.failingRows, 0, "no row will fail");
  assert.equal(findings.warningCount, 6);
  assert.deepEqual(findings.blockers, []);
  assert.deepEqual(findings.pendingDecisions, []);
});

test("the header override moves the first row between header and data", () => {
  const header = [
    "Account No.", "Last Name", "First Name", "Middle Name", "Suffix", "Birthdate",
    "Gender", "Civil Status", "Contact Number", "email", "Street Address", "Barangay",
    "City/Municipality", "Province", "Employer/Business Name", "Monthly Income",
    "Pledge Amt(If Applicable)", "Spouse FName (If Married)", "Spouse MName (If Married)",
    "Spouse LName (If Married)", "Spouse Contact No (If Married)", "Spouse Occupation",
  ];
  const records = customerRows([header, CUSTOMER]);
  const inspection = inspectionStub({
    records,
    header: {
      isHeader: true,
      positionalScore: 1,
      labelScore: 1,
      reordered: false,
      mismatched: [],
    },
    headerFields: header,
  });

  const detected = computeFindings({ customers: inspection }, {}, {});
  assert.equal(detected.customers?.totalRows, 1, "the detected header is not a member");

  const overridden = computeFindings({ customers: inspection }, { customers: false }, {});
  assert.equal(overridden.customers?.totalRows, 2, "the override wins over the detection");
  assert.ok(
    (overridden.customers?.errorCount ?? 0) > 0,
    "importing the labels as a borrower has to be visibly wrong",
  );
});

// ---------------------------------------------------------------------------
// Decoding — the reason this reads through readCsvFile and never .text()
// ---------------------------------------------------------------------------

test("a multi-byte name straddling a chunk boundary survives the read", async () => {
  // 64 KB is `readCsvFile`'s slice size. Pad so a `ñ` sits astride byte 65536:
  // decoding slices independently turns it into two U+FFFD and nothing
  // downstream can tell, because the row count and every width stay correct.
  const padRow = (n: number) => `2019-${String(n).padStart(5, "0")},Santos,Elena,,,1992-07-23,Female,Single,09331234567,e@x.ph,,Magugpo,Tagum,Davao,ABC,18000,3000,,,,,\n`;
  let text = "";
  const encoder = new TextEncoder();
  let n = 0;
  while (encoder.encode(text).length < 65_535) text += padRow(n++);
  // Land the two-byte `ñ` exactly on the cut.
  const lead = 65_535 - encoder.encode(text).length;
  text += `${"a".repeat(Math.max(0, lead))}\n2019-99999,Peña,Roberto,Muñoz,Jr.,1978-11-05,Male,Married,09221234567,r@x.ph,5 Mabini,San Miguel,Tagum,Davao,Self,32000,7500,Ana,Cruz,Peña,09183334444,Teacher\n`;

  const file = new File([text], "customers.csv", { type: "text/csv" });
  const inspection = await inspectFile("customers", file);

  assert.equal(
    inspection.notices.filter((notice) => notice.code === "not-utf8").length,
    0,
    "a replacement character here would mean the decoder was restarted per slice",
  );
  const names = inspection.records.map((r) => r.fields[1]);
  assert.ok(names.includes("Peña"), "Peña must not arrive as Pe�a");
  assert.ok(
    inspection.records.some((r) => r.fields[3] === "Muñoz"),
    "Muñoz must not arrive as Mu�oz",
  );
});

// ---------------------------------------------------------------------------
// describeIsoDate — the words the ambiguity prompt is decided on
// ---------------------------------------------------------------------------

test("an ISO date is put into words without going near a Date object", () => {
  assert.equal(describeIsoDate("1975-04-03"), "3 April 1975");
  assert.equal(describeIsoDate("1975-03-04"), "4 March 1975");
  assert.equal(describeIsoDate("2020-12-31"), "31 December 2020");
  assert.equal(describeIsoDate("2020-01-01"), "1 January 2020");
});

test("the two readings of an ambiguous cell never collapse into the same words", () => {
  // The whole prompt rests on these two being visibly different.
  assert.notEqual(describeIsoDate("1975-04-03"), describeIsoDate("1975-03-04"));
});

test("the words do not move with the machine's timezone", () => {
  // `new Date("1975-04-03")` is UTC midnight, so a US-set laptop renders the
  // 2nd — on the one screen asking an admin to choose between the 3rd and the
  // 4th. Reading the string cannot do that.
  const original = process.env.TZ;
  try {
    for (const zone of ["Asia/Manila", "America/Los_Angeles", "Pacific/Kiritimati", "UTC"]) {
      process.env.TZ = zone;
      assert.equal(describeIsoDate("1975-04-03"), "3 April 1975", `wrong in ${zone}`);
    }
  } finally {
    process.env.TZ = original;
  }
});

test("anything that is not a plain YYYY-MM-DD comes back untouched", () => {
  assert.equal(describeIsoDate("not a date"), "not a date");
  assert.equal(describeIsoDate("1975-13-03"), "1975-13-03");
});

// ---------------------------------------------------------------------------
// sessionAnswers — the answers, written the way the session record stores them
// ---------------------------------------------------------------------------

const answer = (
  kind: "customers" | "loans",
  skipHeaderRow: boolean,
  dateOrders: Record<string, "dmy" | "mdy" | null>,
) => ({ kind, skipHeaderRow, dateOrders });

test("two files that agree each keep their own entry", () => {
  const written = sessionAnswers([
    answer("customers", true, { birthdate: "dmy" }),
    answer("loans", true, { date_released: "dmy", maturity_date: "dmy" }),
  ]);

  assert.deepEqual(written.hasHeaderRow, { customers: true, loans: true });
  assert.deepEqual(written.dateFormat, {
    customers: { birthdate: "dd/MM/yyyy" },
    loans: { date_released: "dd/MM/yyyy", maturity_date: "dd/MM/yyyy" },
  });
});

test("one file with a header and one without is recorded as exactly that", () => {
  // The real case, and the one a single boolean could not hold: the coop
  // deleted the header from one sheet and not the other. The server keys
  // `header_skipped` per file, and so does the record.
  const written = sessionAnswers([
    answer("customers", true, { birthdate: "dmy" }),
    answer("loans", false, { date_released: "dmy", maturity_date: "dmy" }),
  ]);

  assert.equal(written.hasHeaderRow.customers, true);
  assert.equal(written.hasHeaderRow.loans, false);
});

test("two date orders in one import both survive, per file", () => {
  const written = sessionAnswers([
    answer("customers", true, { birthdate: "dmy" }),
    answer("loans", true, { date_released: "mdy", maturity_date: "mdy" }),
  ]);

  assert.equal(written.dateFormat.customers?.birthdate, "dd/MM/yyyy");
  assert.equal(written.dateFormat.loans?.date_released, "MM/dd/yyyy");
});

test("two date orders in one FILE survive too — the grain is the column", () => {
  // Widening to per file must not flatten what is settled per column: a sheet
  // can genuinely prove day-first in one column and month-first in another.
  const written = sessionAnswers([
    answer("loans", true, { date_released: "dmy", maturity_date: "mdy" }),
  ]);

  assert.deepEqual(written.dateFormat.loans, {
    date_released: "dd/MM/yyyy",
    maturity_date: "MM/dd/yyyy",
  });
});

test("a column of ISO dates and serials needs no order, and is recorded as ISO", () => {
  const written = sessionAnswers([answer("customers", false, { birthdate: null })]);

  assert.equal(written.dateFormat.customers?.birthdate, ISO_DATE_FORMAT);
});

test("a single file does not invent a second one's opinion", () => {
  const written = sessionAnswers([answer("loans", false, { date_released: "mdy" })]);

  // Absent, NOT false. A missing key means "not answered"; `false` would mean
  // "answered: no header", and re-applying that to a file nobody asked about is
  // how a member row gets eaten as a heading on resume.
  assert.equal(written.hasHeaderRow.customers, undefined);
  assert.equal("customers" in written.hasHeaderRow, false);
  assert.equal(written.dateFormat.customers, undefined);
  assert.equal(written.hasHeaderRow.loans, false);
});

test("no files at all is a defined answer, not a crash", () => {
  const written = sessionAnswers([]);
  assert.deepEqual(written.hasHeaderRow, {});
  assert.deepEqual(written.dateFormat, {});
});

test("a file with no date columns still records its header answer", () => {
  const written = sessionAnswers([answer("customers", true, {})]);
  assert.equal(written.hasHeaderRow.customers, true);
  assert.deepEqual(written.dateFormat.customers, {});
});

// ---------------------------------------------------------------------------
// The share capital file (finish run round 2, decision 13)
// ---------------------------------------------------------------------------

/** A valid share capital row: account, date, reference, type, amount, remarks. */
const SHARE: string[] = ["2019-00101", "2026-01-15", "OR-1001", "Contribution", "1500.00", "Opening share capital"];

const SHARE_CONTEXT = {
  kind: "share_capital" as const,
  shape: "share_capital" as const,
  dates: NO_DATES,
  knownAccounts: null,
  expectedColumns: 6,
  today: "2026-11-24",
};

/** Share capital records from line 2 on, as under a header row. */
function shareRows(rows: readonly (readonly string[])[]): CsvRecord[] {
  return rows.map((fields, i) => record(fields, i + 2));
}

function share(changes: Record<number, string>): string[] {
  const row = [...SHARE];
  for (const [index, value] of Object.entries(changes)) row[Number(index)] = value;
  return row;
}

test("a share capital row the server takes passes, in either type's words", () => {
  const result = checkRows(
    shareRows([SHARE, share({ 2: "", 3: "Withdrawal", 4: "250" }), share({ 0: "BRW-000007", 2: "OR-2", 3: "CR" }), share({ 2: "OR-3", 3: "dr", 4: "₱1,000.50" })]),
    SHARE_CONTEXT,
  );

  assert.equal(result.errorCount, 0, result.issues.map((issue) => issue.message).join(" | "));
  assert.equal(result.warningCount, 0, "a member's account on many rows is what this file is");
});

test("the transaction date is written year-month-day, from 1900 and not after today", () => {
  const cases: Array<[string, RegExp]> = [
    ["03/04/2026", /^Transaction Date "03\/04\/2026" isn't a date written as year-month-day, such as 2026-11-24\.$/],
    ["2026-02-30", /isn't a date written as year-month-day/],
    ["45000", /isn't a date written as year-month-day/],
    ["2026-11-25", /^Transaction Date "2026-11-25" is after today, and a share capital entry can't be dated in the future\.$/],
    ["1899-12-31", /^Transaction Date "1899-12-31" is before 1900, too early for a share capital entry\. Check the year\.$/],
  ];

  for (const [date, message] of cases) {
    const result = checkRows(shareRows([share({ 1: date })]), SHARE_CONTEXT);
    assert.equal(result.errorCount, 1, date);
    assert.equal(result.issues[0].column, "Transaction Date", date);
    assert.equal(result.issues[0].category, "date", date);
    assert.match(result.issues[0].message, message, date);
  }

  assert.equal(checkRows(shareRows([share({ 1: "2026-11-24" })]), SHARE_CONTEXT).errorCount, 0, "today is allowed");
  assert.equal(checkRows(shareRows([share({ 1: "1900-01-01" })]), SHARE_CONTEXT).errorCount, 0);
});

test("the amount is above ₱0.00 with at most two decimals", () => {
  const zero = checkRows(shareRows([share({ 4: "0.00" })]), SHARE_CONTEXT);
  assert.equal(zero.errorCount, 1);
  assert.equal(zero.issues[0].message, "Amount is ₱0.00. A share capital entry moves money, so its amount must be above ₱0.00.");

  const negative = checkRows(shareRows([share({ 4: "-500" })]), SHARE_CONTEXT);
  assert.equal(negative.errorCount, 1);
  assert.equal(negative.issues[0].message, 'Amount "-500" is a negative amount, which can\'t be imported. A withdrawal is written as a positive amount with Transaction Type Withdrawal.');

  assert.equal(checkRows(shareRows([share({ 4: "1.005" })]), SHARE_CONTEXT).issues[0].message, "Amount has more decimal places than this field stores (2).");
  assert.equal(checkRows(shareRows([share({ 4: "five hundred" })]), SHARE_CONTEXT).errorCount, 1);
  assert.equal(checkRows(shareRows([share({ 4: "(500.00)" })]), SHARE_CONTEXT).errorCount, 1);
});

test("an unknown transaction type quotes the two it takes", () => {
  const result = checkRows(shareRows([share({ 3: "Dividend" })]), SHARE_CONTEXT);

  assert.equal(result.errorCount, 1);
  assert.equal(result.issues[0].message, '"Dividend" is not a value Transaction Type accepts. Expected one of: Contribution, Withdrawal.');
});

test("a blank member, date, type or amount fails the row; a reference and remarks may be blank", () => {
  const result = checkRows(shareRows([share({ 0: "", 1: "", 3: "", 4: "" }), share({ 2: "", 5: "" })]), SHARE_CONTEXT);

  assert.deepEqual(
    result.issues.map((issue) => [issue.line, issue.column, issue.category]),
    [
      [2, "Account No. or Member ID", "required"],
      [2, "Transaction Date", "required"],
      [2, "Transaction Type", "required"],
      [2, "Amount", "required"],
    ],
  );
});

test("nothing that names the entry is cut short, and long remarks are a warning the server repairs", () => {
  const long = checkRows(shareRows([share({ 0: "7".repeat(51), 2: "R".repeat(101) })]), SHARE_CONTEXT);
  assert.deepEqual(long.issues.map((issue) => [issue.column, issue.severity]), [
    ["Account No. or Member ID", "error"],
    ["Reference Number", "error"],
  ]);

  const remarks = checkRows(shareRows([share({ 5: "x".repeat(300) })]), SHARE_CONTEXT);
  assert.equal(remarks.errorCount, 0);
  assert.equal(remarks.warningCount, 1);
  assert.equal(remarks.issues[0].message, "Remarks is 300 characters. The import keeps the first 255 as the entry's description.");
});

test("a row repeating an earlier row of the file fails, naming that line, and the first is kept", () => {
  const result = checkRows(
    shareRows([
      share({ 2: "OR-7", 4: "100" }),
      share({ 2: "or-7", 4: "999" }),
      share({ 2: "", 4: "40" }),
      share({ 0: "2019-00101 ", 2: "", 4: "40.00" }),
      share({ 2: "", 4: "41" }),
      // No reference, the same figures as the referenced first row: nothing tells them apart.
      share({ 2: "", 4: "100" }),
    ]),
    SHARE_CONTEXT,
  );

  assert.deepEqual(
    result.issues.map((issue) => [issue.line, issue.column, issue.category, issue.message]),
    [
      [3, "Reference Number", "duplicate", "Reference or-7 is also on line 2 of this file. A reference number belongs to one transaction, so only that first row is imported."],
      [5, null, "duplicate", "This row repeats line 4 of this file: the same member, date, type and amount, with no reference number. Only that first row is imported; if both are real, give each its own reference number."],
      [7, null, "duplicate", "This row repeats line 2 of this file: the same member, date, type and amount, with no reference number. Only that first row is imported; if both are real, give each its own reference number."],
    ],
  );
  assert.equal(result.failingRows, 3);
});

test("a row that already fails is not remembered as the first", () => {
  const result = checkRows(shareRows([share({ 2: "OR-1", 4: "0" }), share({ 2: "OR-1" })]), SHARE_CONTEXT);

  assert.deepEqual(result.issues.map((issue) => issue.line), [2]);
});

test("a member not in the members file is a warning: members already in Lendyph are matched on the server", () => {
  const result = checkRows(shareRows([share({ 0: "BRW-000007" })]), {
    ...SHARE_CONTEXT,
    knownAccounts: new Set(["2019-00101"]),
  });

  assert.equal(result.errorCount, 0);
  assert.equal(result.warningCount, 1);
  assert.equal(result.issues[0].category, "cross-file");
  assert.equal(
    result.issues[0].message,
    "No member with account number BRW-000007 is in the members file. A member already in Lendyph is matched on the server by account number or member ID, so this row can still land; if no member has it, the row is refused.",
  );
});

test("the share capital file is read and checked beside the members file", async () => {
  const members = membersFile([CUSTOMER]);
  const shareCapital = new File(
    ["Account No. or Member ID,Transaction Date,Reference Number,Transaction Type,Amount,Remarks\r\n2019-00101,2026-01-15,OR-1,Contribution,500,\r\n2020-00999,2026-01-16,OR-2,Contribution,500,\r\n"],
    "share-capital.csv",
    { type: "text/csv" },
  );
  const inspections = {
    customers: await inspectFile("customers", members),
    share_capital: await inspectFile("share_capital", shareCapital),
  };

  assert.equal(inspections.share_capital.shape, "share_capital");
  assert.equal(inspections.share_capital.expectedColumns, 6);
  assert.equal(inspections.share_capital.label, "Share capital file");

  const findings = computeFindings(inspections, {}, {}).share_capital;
  assert.ok(findings);
  assert.equal(findings.totalRows, 2);
  assert.deepEqual(findings.blockers, []);
  assert.deepEqual(findings.dates, [], "the date is checked as written, not settled to an order");
  assert.deepEqual(findings.issues.map((issue) => [issue.line, issue.category]), [[3, "cross-file"]]);
});

test("an empty share capital file says it can be left out", async () => {
  const inspection = await inspectFile(
    "share_capital",
    new File(["Account No. or Member ID,Transaction Date,Reference Number,Transaction Type,Amount,Remarks\r\n"], "share-capital.csv", { type: "text/csv" }),
  );

  assert.deepEqual(computeFindings({ share_capital: inspection }, {}, {}).share_capital?.blockers, [
    "Share capital file (share-capital.csv): The only row in this file is the header row, so there is nothing to import. The share capital file is optional: leave it out when there is no share capital to bring over.",
  ]);
});
