import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { csvBlob } from "@/lib/csv";
import { csvRow } from "@/lib/csv-escape";
import { CUSTOMER_COLUMNS, LOAN_COLUMNS, SHARE_CAPITAL_COLUMNS, detectHeaderRow } from "@/lib/import-schema";
import {
  computeFindings,
  inspectFile,
} from "@/app/(app)/settings/data-import/_hooks/use-file-precheck";
import {
  IMPORT_TEMPLATES,
  MEMBERS_TEMPLATE_NOTE,
  SHARE_CAPITAL_TEMPLATE_NOTE,
  importTemplateCsv,
  importTemplates,
} from "./import-template";

/** A valid member row as the workbook had it: 22 columns, ending at Spouse Occupation. */
const OLD_MEMBER_ROW = [
  "2019-00101", "Dela Cruz", "Maria", "Santos", "", "1985-03-12", "Female", "Married",
  "09171234567", "maria@example.com", "12 Rizal St", "Poblacion", "Tagum City",
  "Davao del Norte", "Market", "25000.00", "5000.00", "Jose", "Reyes", "Dela Cruz",
  "09181112222", "Driver",
];

/** A valid member row, in the template's column order. */
const MEMBER_ROW = [...OLD_MEMBER_ROW, "2012-06-01", "2010-03-15", "Regular", "BC-0007"];

/** The workbook's own header: every file made before the four columns were added. */
const OLD_HEADER = CUSTOMER_COLUMNS.slice(0, 22).map((column) => column.label);

/** A valid loan row, in the template's column order. */
const LOAN_ROW = [
  "2019-00101", "2019-L-0001", "50000.00", "20000.00", "2.0000", "12000.00", "4800.00",
  "Business capital", "Regular Loan", "12", "Monthly", "Diminishing", "2025-01-15",
  "2026-01-15", "1000.00", "500.00", "", "",
];

test("the members template is the members file's labels, in column order, and nothing else", () => {
  assert.equal(
    importTemplateCsv("customer"),
    `${CUSTOMER_COLUMNS.map((column) => column.label).join(",")}\r\n`,
  );
  assert.ok(importTemplateCsv("customer").startsWith("Account No.,Last Name,First Name,"));
});

test("the members template carries the four Member Profile columns after the spouse's", () => {
  assert.ok(
    importTemplateCsv("customer").endsWith(
      ",Spouse Occupation (If Married),Date Hired,Membership Date,Member Type,Membership Number\r\n",
    ),
  );
  assert.equal(importTemplateCsv("customer").trimEnd().split(",").length, 26);
});

test("the loans template is the loans file's labels, in column order, and nothing else", () => {
  assert.equal(
    importTemplateCsv("loans"),
    `${LOAN_COLUMNS.map((column) => column.label).join(",")}\r\n`,
  );
  assert.ok(importTemplateCsv("loans").startsWith("Account No.,Loan No.,Loan Amount,"));
});

test("the share capital template is its six columns, in order, and nothing else", () => {
  assert.equal(
    importTemplateCsv("share_capital"),
    "Account No. or Member ID,Transaction Date,Reference Number,Transaction Type,Amount,Remarks\r\n",
  );
  assert.equal(importTemplateCsv("share_capital"), `${SHARE_CAPITAL_COLUMNS.map((column) => column.label).join(",")}\r\n`);
});

test("a label holding a comma or a quote is quoted per RFC 4180", () => {
  assert.equal(
    importTemplateCsv([{ label: "Amount, in pesos" }, { label: 'The "Ref"' }, { label: "Plain" }]),
    '"Amount, in pesos","The ""Ref""",Plain\r\n',
  );
});

test("each template is named for its file and downloads as CSV", () => {
  assert.deepEqual(
    IMPORT_TEMPLATES.map(({ shape, buttonLabel, fileName }) => ({ shape, buttonLabel, fileName })),
    [
      { shape: "customer", buttonLabel: "Download members template", fileName: "members-import-template.csv" },
      { shape: "loans", buttonLabel: "Download loans template", fileName: "loans-import-template.csv" },
      { shape: "share_capital", buttonLabel: "Download share capital template", fileName: "share-capital-import-template.csv" },
    ],
  );
  assert.deepEqual(importTemplates(true), IMPORT_TEMPLATES);
  assert.deepEqual(importTemplates(false).map((template) => template.shape), ["customer", "loans"]);
});

test("the template's header row is read as the header, every label in its place", () => {
  for (const shape of ["customer", "loans", "share_capital"] as const) {
    const header = importTemplateCsv(shape).trimEnd().split(",");
    const detection = detectHeaderRow(header, shape);
    assert.equal(detection.isHeader, true, shape);
    assert.equal(detection.positionalScore, 1, shape);
    assert.equal(detection.labelScore, 1, shape);
    assert.deepEqual(detection.mismatched, [], shape);
  }
});

test("a members file made from the template passes the pre-check with its header row", async () => {
  const text = importTemplateCsv("customer") + csvRow(MEMBER_ROW);
  const file = new File([csvBlob(text)], "members.csv", { type: "text/csv" });
  const inspection = await inspectFile("customers", file);

  assert.equal(inspection.header?.isHeader, true);
  assert.equal(inspection.header?.reordered, false);
  assert.equal(inspection.slot?.shape, "customer");

  const findings = computeFindings({ customers: inspection }, {}, {}).customers;
  assert.ok(findings);
  assert.equal(findings.totalRows, 1, "the header row is not imported as a member");
  assert.deepEqual(findings.blockers, []);
  assert.equal(findings.errorCount, 0);
});

test("an old members file without the four new columns still passes, with or without its header", async () => {
  for (const withHeader of [true, false]) {
    const records = [OLD_MEMBER_ROW, ["2019-00102", ...OLD_MEMBER_ROW.slice(1)]];
    const text = (withHeader ? [OLD_HEADER, ...records] : records).map(csvRow).join("\r\n") + "\r\n";
    const file = new File([csvBlob(text)], "old-members.csv", { type: "text/csv" });
    const inspection = await inspectFile("customers", file);

    assert.equal(inspection.expectedColumns, 22, "the file is held to its own layout");
    assert.equal(inspection.header?.isHeader, withHeader);
    assert.equal(inspection.slot?.shape, "customer");
    if (withHeader) assert.deepEqual(inspection.header?.mismatched, [], "an old header matches its own columns");

    const findings = computeFindings({ customers: inspection }, {}, {}).customers;
    assert.ok(findings);
    assert.equal(findings.totalRows, 2);
    assert.deepEqual(findings.blockers, []);
    assert.equal(findings.errorCount, 0, findings.issues.map((issue) => issue.message).join(" | "));
    assert.deepEqual(findings.pendingDecisions, []);
  }
});

test("a loans file made from the template passes the pre-check with its header row", async () => {
  const text = importTemplateCsv("loans") + csvRow(LOAN_ROW);
  const file = new File([csvBlob(text)], "loans.csv", { type: "text/csv" });
  const inspection = await inspectFile("loans", file);

  assert.equal(inspection.header?.isHeader, true);
  assert.equal(inspection.header?.reordered, false);
  assert.equal(inspection.slot?.shape, "loans");

  const findings = computeFindings({ loans: inspection }, {}, {}).loans;
  assert.ok(findings);
  assert.equal(findings.totalRows, 1, "the header row is not imported as a loan");
  assert.deepEqual(findings.blockers, []);
  assert.equal(findings.errorCount, 0);
});

test("a share capital file made from the template passes the pre-check with its header row", async () => {
  const rows = [
    ["2019-00101", "2026-01-15", "OR-1001", "Contribution", "1,500.00", "Opening share capital"],
    ["BRW-000007", "2026-02-15", "", "Withdrawal", "250", ""],
  ];
  const text = importTemplateCsv("share_capital") + rows.map(csvRow).join("\r\n") + "\r\n";
  const file = new File([csvBlob(text)], "share-capital.csv", { type: "text/csv" });
  const inspection = await inspectFile("share_capital", file);

  assert.equal(inspection.header?.isHeader, true);
  assert.equal(inspection.slot?.shape, "share_capital");

  const findings = computeFindings({ share_capital: inspection }, {}, {}).share_capital;
  assert.ok(findings);
  assert.equal(findings.totalRows, 2, "the header row is not imported as an entry");
  assert.deepEqual(findings.blockers, []);
  assert.deepEqual(findings.pendingDecisions, [], "no date order to choose: the date is written year-month-day");
  assert.equal(findings.errorCount, 0, findings.issues.map((issue) => issue.message).join(" | "));
});

test("the Prepare step offers the templates beside the files", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/(app)/settings/data-import/_components/step-prepare.tsx"),
    "utf8",
  );
  assert.match(source, /importTemplates\(shareCapitalAllowed\)\.map\(/);
  assert.match(source, /downloadImportTemplate\(template\)/);
});

test("the Prepare step says what the share capital file takes and what becomes of it", () => {
  assert.match(SHARE_CAPITAL_TEMPLATE_NOTE, /Contribution or Withdrawal/);
  assert.match(SHARE_CAPITAL_TEMPLATE_NOTE, /year-month-day, such as 2026-11-24/);
  assert.match(SHARE_CAPITAL_TEMPLATE_NOTE, /above ₱0\.00/);
  assert.match(SHARE_CAPITAL_TEMPLATE_NOTE, /account number or member ID/);
  assert.match(SHARE_CAPITAL_TEMPLATE_NOTE, /same reference/);
  assert.match(SHARE_CAPITAL_TEMPLATE_NOTE, /Share Capital ledger/);
  assert.match(SHARE_CAPITAL_TEMPLATE_NOTE, /nothing to the books/);
  assert.doesNotMatch(SHARE_CAPITAL_TEMPLATE_NOTE, /[Bb]orrower|_/);

  const source = readFileSync(
    join(process.cwd(), "src/app/(app)/settings/data-import/_components/step-prepare.tsx"),
    "utf8",
  );
  assert.match(source, /\{SHARE_CAPITAL_TEMPLATE_NOTE\}/);
});

test("the Prepare step says valid IDs and photos are not imported, and that old files still are", () => {
  assert.match(MEMBERS_TEMPLATE_NOTE, /Valid IDs and member photos are files/);
  assert.match(MEMBERS_TEMPLATE_NOTE, /member's profile/);
  assert.match(MEMBERS_TEMPLATE_NOTE, /made before Date Hired and the membership columns/);
  assert.match(MEMBERS_TEMPLATE_NOTE, /Member Type reads Regular, the default/);
  assert.doesNotMatch(MEMBERS_TEMPLATE_NOTE, /those fields left blank/, "Member Type is not left blank");
  assert.doesNotMatch(MEMBERS_TEMPLATE_NOTE, /[Bb]orrower/, "Member, never Borrower");

  const source = readFileSync(
    join(process.cwd(), "src/app/(app)/settings/data-import/_components/step-prepare.tsx"),
    "utf8",
  );
  assert.match(source, /\{MEMBERS_TEMPLATE_NOTE\}/);
});
