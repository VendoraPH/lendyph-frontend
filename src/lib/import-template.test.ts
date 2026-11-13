import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { csvBlob } from "@/lib/csv";
import { csvRow } from "@/lib/csv-escape";
import { CUSTOMER_COLUMNS, LOAN_COLUMNS, detectHeaderRow } from "@/lib/import-schema";
import {
  computeFindings,
  inspectFile,
} from "@/app/(app)/settings/data-import/_hooks/use-file-precheck";
import { IMPORT_TEMPLATES, importTemplateCsv } from "./import-template";

/** A valid member row, in the template's column order. */
const MEMBER_ROW = [
  "2019-00101", "Dela Cruz", "Maria", "Santos", "", "1985-03-12", "Female", "Married",
  "09171234567", "maria@example.com", "12 Rizal St", "Poblacion", "Tagum City",
  "Davao del Norte", "Market", "25000.00", "5000.00", "Jose", "Reyes", "Dela Cruz",
  "09181112222", "Driver",
];

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

test("the loans template is the loans file's labels, in column order, and nothing else", () => {
  assert.equal(
    importTemplateCsv("loans"),
    `${LOAN_COLUMNS.map((column) => column.label).join(",")}\r\n`,
  );
  assert.ok(importTemplateCsv("loans").startsWith("Account No.,Loan No.,Loan Amount,"));
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
    ],
  );
});

test("the template's header row is read as the header, every label in its place", () => {
  for (const shape of ["customer", "loans"] as const) {
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

test("the Prepare step offers both templates beside the files", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/(app)/settings/data-import/_components/step-prepare.tsx"),
    "utf8",
  );
  assert.match(source, /IMPORT_TEMPLATES\.map\(/);
  assert.match(source, /downloadImportTemplate\(template\)/);
});
