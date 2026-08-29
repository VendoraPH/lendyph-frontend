import assert from "node:assert/strict";
import test from "node:test";
import type { CsvRecord } from "@/lib/csv-parse";
import {
  ISO_DATE_FORMAT,
  ISSUE_LIST_CAP,
  checkRows,
  collapseForSession,
  computeFindings,
  describeIsoDate,
  fileBlockers,
  inspectFile,
  type DateColumnFinding,
  type FileInspection,
} from "./use-file-precheck";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A complete, valid Customer Profile row. Mutate a copy to make one bad. */
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

test("a blank required field fails the row and names the column", () => {
  const row = [...CUSTOMER];
  row[11] = ""; // Barangay

  const result = checkRows(customerRows([row]), CUSTOMER_CONTEXT);

  assert.equal(result.failingRows, 1);
  assert.equal(result.issues[0].category, "required");
  assert.equal(result.issues[0].column, "Barangay");
});

test("a row of the wrong width is reported once, as a whole-row problem", () => {
  const result = checkRows(customerRows([CUSTOMER.slice(0, 21)]), CUSTOMER_CONTEXT);

  const columnIssues = result.issues.filter((issue) => issue.category === "columns");
  assert.equal(columnIssues.length, 1);
  assert.equal(columnIssues[0].column, null);
  assert.match(columnIssues[0].message, /21 columns/);
});

test("an unknown closed-vocabulary value quotes the options back", () => {
  const row = [...CUSTOMER];
  row[6] = "Lalake";

  const result = checkRows(customerRows([row]), CUSTOMER_CONTEXT);

  assert.equal(result.issues[0].category, "value");
  assert.match(result.issues[0].message, /Expected one of/);
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
// Truncation
// ---------------------------------------------------------------------------

test("capping the issue LIST never caps the issue COUNT", () => {
  const bad = [...CUSTOMER];
  bad[11] = ""; // Barangay blank on every row
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
    label: "Customer Profile",
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
    slot: { shape: "customer", customerScore: 1, loansScore: 0, basis: "content" },
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
    slot: { shape: "loans", customerScore: 0.1, loansScore: 0.9, basis: "content" },
  });

  const blockers = fileBlockers(inspection, customerRows([CUSTOMER]), NO_DATES);

  assert.equal(blockers.length, 1);
  assert.match(blockers[0], /looks like the Loans file/);
});

test("a file whose rows are systematically the wrong width is blocked once", () => {
  const inspection = inspectionStub({ widths: [{ columns: 18, rows: 400 }] });

  const blockers = fileBlockers(inspection, customerRows([CUSTOMER]), NO_DATES);

  assert.equal(blockers.length, 1);
  assert.match(blockers[0], /Most rows have 18 columns/);
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
// collapseForSession — the session record is narrower than the answers
// ---------------------------------------------------------------------------

const answer = (
  label: string,
  skipHeaderRow: boolean,
  dateOrders: Record<string, "dmy" | "mdy" | null>,
) => ({ label, skipHeaderRow, dateOrders });

test("two files that agree collapse with nothing lost", () => {
  const collapsed = collapseForSession([
    answer("Customer Profile", true, { birthdate: "dmy" }),
    answer("Loans", true, { date_released: "dmy", maturity_date: "dmy" }),
  ]);

  assert.equal(collapsed.hasHeaderRow, true);
  assert.equal(collapsed.dateFormat, "dd/MM/yyyy");
  assert.deepEqual(collapsed.losses, []);
});

test("a column of ISO dates and serials needs no order, and says so", () => {
  const collapsed = collapseForSession([answer("Customer Profile", false, { birthdate: null })]);

  assert.equal(collapsed.dateFormat, ISO_DATE_FORMAT);
  assert.deepEqual(collapsed.losses, []);
});

test("one file with a header and one without is reported, not silently picked", () => {
  // The real case: the coop deleted the header from one sheet and not the
  // other. The server keys `header_skipped` per file; the session record holds
  // one boolean, so the shortfall has to reach the admin.
  const collapsed = collapseForSession([
    answer("Customer Profile", true, { birthdate: "dmy" }),
    answer("Loans", false, { date_released: "dmy", maturity_date: "dmy" }),
  ]);

  assert.equal(collapsed.losses.length, 1);
  assert.match(collapsed.losses[0], /Customer Profile has a header row and Loans does not/);
  assert.match(collapsed.losses[0], /resume/);
});

test("two date orders in one import are reported rather than averaged away", () => {
  const collapsed = collapseForSession([
    answer("Customer Profile", true, { birthdate: "dmy" }),
    answer("Loans", true, { date_released: "mdy", maturity_date: "mdy" }),
  ]);

  assert.equal(collapsed.losses.length, 1);
  assert.match(collapsed.losses[0], /more than one date order/);
  // It still emits a usable value — a loss is a disclosure, not a failure.
  assert.ok(["dd/MM/yyyy", "MM/dd/yyyy"].includes(collapsed.dateFormat));
});

test("a single file collapses without inventing a second one's opinion", () => {
  const collapsed = collapseForSession([answer("Loans", false, { date_released: "mdy" })]);

  assert.equal(collapsed.hasHeaderRow, false);
  assert.equal(collapsed.dateFormat, "MM/dd/yyyy");
  assert.deepEqual(collapsed.losses, []);
});

test("no files at all is a defined answer, not a crash", () => {
  const collapsed = collapseForSession([]);
  assert.equal(collapsed.hasHeaderRow, false);
  assert.equal(collapsed.dateFormat, ISO_DATE_FORMAT);
  assert.deepEqual(collapsed.losses, []);
});
