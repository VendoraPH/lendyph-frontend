import { test } from "node:test";
import assert from "node:assert/strict";
import { renderImportErrorCsv, type ImportIssue } from "./import-error-csv";

const lines = (csv: string) => csv.split("\r\n");

const ISSUE: ImportIssue = {
  row: 12,
  column: "Birth Date",
  value: "31/02/1988",
  problem: "Not a real date.",
};

test("the header names the four things an admin needs to find the row", () => {
  assert.equal(lines(renderImportErrorCsv([]))[0], "Row,Column,Value,Problem");
});

test("an empty report is the header alone, not a blank file", () => {
  assert.equal(renderImportErrorCsv([]), "Row,Column,Value,Problem");
});

test("an issue renders as one record, with the row number the admin sees", () => {
  assert.deepEqual(lines(renderImportErrorCsv([ISSUE])), [
    "Row,Column,Value,Problem",
    "12,Birth Date,31/02/1988,Not a real date.",
  ]);
});

test("records are separated by CRLF, as every spreadsheet expects", () => {
  const csv = renderImportErrorCsv([ISSUE, { ...ISSUE, row: 13 }]);
  assert.ok(csv.includes("\r\n13,"));
  assert.equal(lines(csv).length, 3);
});

// --- escaping -----------------------------------------------------------------

// The whole file is comma-separated, so a comma in a message silently invents a
// column and every value after it lands under the wrong heading.
test("a comma in the problem is quoted", () => {
  const csv = renderImportErrorCsv([
    { row: 4, column: "Amount", value: "12,500.00", problem: "Remove the comma, then re-upload." },
  ]);
  assert.equal(
    lines(csv)[1],
    '4,Amount,"12,500.00","Remove the comma, then re-upload."'
  );
});

test("a quote is doubled and the field is quoted", () => {
  const csv = renderImportErrorCsv([
    { row: 7, column: "Name", value: 'Juan "Boy" Dela Cruz', problem: 'Contains a " character.' },
  ]);
  assert.equal(
    lines(csv)[1],
    '7,Name,"Juan ""Boy"" Dela Cruz","Contains a "" character."'
  );
});

// A member's address pasted out of Excel keeps its line break. Unquoted it ends
// the record early, and everything after it reads as a new row with a garbage
// row number — the report about broken rows would itself be broken.
test("an embedded newline is quoted, so the record is not split in two", () => {
  const csv = renderImportErrorCsv([
    { row: 9, column: "Address", value: "Purok 3\nBrgy. Poblacion", problem: "Line break in cell." },
  ]);
  assert.equal(lines(csv).length, 2, "still one header and one record");
  assert.equal(lines(csv)[1], '9,Address,"Purok 3\nBrgy. Poblacion",Line break in cell.');
});

test("a CRLF or a lone CR in a value is quoted too", () => {
  const crlf = renderImportErrorCsv([{ row: 1, value: "a\r\nb", problem: "x" }]);
  assert.ok(crlf.includes('"a\r\nb"'));
  const cr = renderImportErrorCsv([{ row: 1, value: "a\rb", problem: "x" }]);
  assert.ok(cr.includes('"a\rb"'), "a lone CR would otherwise break the record");
});

test("ordinary values are left alone rather than quoted defensively", () => {
  const csv = renderImportErrorCsv([{ row: 2, column: "Status", value: "active", problem: "Unknown status." }]);
  assert.equal(lines(csv)[1], "2,Status,active,Unknown status.");
});

test("all three troublemakers in one value survive together", () => {
  const csv = renderImportErrorCsv([
    { row: 3, value: 'a,b"c\nd', problem: 'say "no", twice\nplease' },
  ]);
  assert.equal(lines(csv)[1], '3,,"a,b""c\nd","say ""no"", twice\nplease"');
});

// --- optional fields ----------------------------------------------------------

test("a row-level problem with no column or value still fills its cells", () => {
  const csv = renderImportErrorCsv([{ row: 21, problem: "Duplicate member number." }]);
  assert.equal(lines(csv)[1], "21,,,Duplicate member number.");
});

test("the File column is omitted when only one file was checked", () => {
  const csv = renderImportErrorCsv([ISSUE]);
  assert.ok(!csv.startsWith("File,"));
  assert.equal(lines(csv)[1].split(",").length, 4);
});

test("the File column appears as soon as one issue names a file", () => {
  const csv = renderImportErrorCsv([
    { ...ISSUE, file: "binhs-members.csv" },
    { row: 3, problem: "Missing amount." },
  ]);
  assert.deepEqual(lines(csv), [
    "File,Row,Column,Value,Problem",
    "binhs-members.csv,12,Birth Date,31/02/1988,Not a real date.",
    ",3,,,Missing amount.",
  ]);
});

test("a file name containing a comma does not shift every column", () => {
  const csv = renderImportErrorCsv([{ file: "members, final.csv", row: 1, problem: "Bad." }]);
  assert.equal(lines(csv)[1], '"members, final.csv",1,,,Bad.');
});

// --- formula injection --------------------------------------------------------

// The values in this report come out of the co-op's own spreadsheet and go
// straight back into the admin's Excel, which is the textbook path for this.
// The treatment is the API's, so the server-generated error report and this one
// escape the same cell the same way.
test("a cell that would be evaluated as a formula is neutralised", () => {
  const csv = renderImportErrorCsv([
    { row: 5, column: "Name", value: "=HYPERLINK(\"http://x\",\"click\")", problem: "Unexpected characters." },
  ]);
  assert.ok(lines(csv)[1].includes(`"'\t=HYPERLINK(""http://x"",""click"")"`));
});

test("all six triggers are covered, and ordinary values are untouched", () => {
  const issues: ImportIssue[] = ["=a", "+a", "-a", "@a", "\ta", "\ra", "Juan"].map(
    (value, i) => ({ row: i + 1, value, problem: "x" })
  );
  const rows = lines(renderImportErrorCsv(issues)).slice(1);
  for (const row of rows.slice(0, 6)) assert.ok(row.includes("'\t"), row);
  assert.equal(rows[6], "7,,Juan,x");
});

// A negative amount in the VALUE column gets the prefix, and that is accepted
// rather than special-cased: matching the backend byte for byte matters more
// than one tidy-looking cell, and the admin is reading this to find a row, not
// to sum it.
test("a negative amount in an error report is prefixed, matching the backend", () => {
  const csv = renderImportErrorCsv([{ row: 8, column: "Amount", value: "-500", problem: "Must be positive." }]);
  assert.equal(lines(csv)[1], "8,Amount,'\t-500,Must be positive.");
});

test("the heading row is ours and is not neutralised", () => {
  const csv = renderImportErrorCsv([{ row: 1, problem: "x" }]);
  assert.equal(lines(csv)[0], "Row,Column,Value,Problem");
  assert.ok(!lines(csv)[0].includes("'"));
});
