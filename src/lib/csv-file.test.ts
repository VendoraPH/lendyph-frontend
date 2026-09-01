import { test } from "node:test";
import assert from "node:assert/strict";
import { CSV_FILE_ACCEPT, looksLikeCsv, type CsvFileLike } from "./csv-file";

const file = (name: string, size = 1024): CsvFileLike => ({ name, size });

test("a .csv file passes", () => {
  assert.deepEqual(looksLikeCsv(file("members.csv")), { ok: true });
});

test("the extension is matched case-insensitively", () => {
  assert.equal(looksLikeCsv(file("MEMBERS.CSV")).ok, true);
  assert.equal(looksLikeCsv(file("Members.Csv")).ok, true);
});

test("a .tsv file passes, because the parser can detect tabs", () => {
  assert.equal(looksLikeCsv(file("members.tsv")).ok, true);
});

// The whole reason this is not validateUploadFile: the browser reports a CSV's
// type as text/csv, application/vnd.ms-excel (whenever Excel owns the .csv
// association on Windows), application/csv, or "" — none of which the user can
// change, and a MIME allowlist rejects the file on every value but the first.
test("MIME type is never consulted, so an Excel-associated CSV still passes", () => {
  // Real Files, which also pins the other half of the contract: a DOM File
  // satisfies CsvFileLike, so the page passes one straight through.
  const excelAssociated = new File(["id,name\n1,Juan\n"], "members.csv", {
    type: "application/vnd.ms-excel",
  });
  assert.equal(looksLikeCsv(excelAssociated).ok, true);
  assert.equal(looksLikeCsv(new File(["id\n"], "members.csv", { type: "" })).ok, true);
  assert.equal(looksLikeCsv(new File(["id\n"], "members.csv", { type: "text/csv" })).ok, true);
});

// 5 MB is the shared ID-photo limit and is far too small for a member migration.
test("a file well past the shared 5 MB upload limit passes by default", () => {
  assert.equal(looksLikeCsv(file("members.csv", 40 * 1024 * 1024)).ok, true);
});

test("a filename with dots only reads the last extension", () => {
  assert.equal(looksLikeCsv(file("members.2026-08-27.final.csv")).ok, true);
});

test("a non-CSV extension is refused", () => {
  const result = looksLikeCsv(file("photo.png"));
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /CSV/);
});

test("a file with no extension at all is refused", () => {
  assert.equal(looksLikeCsv(file("members")).ok, false);
});

// A coop sending an .xlsx has not broken a rule, they just have not exported
// yet — so the message is the instruction, not the refusal.
test("a workbook is told how to become a CSV", () => {
  const result = looksLikeCsv(file("members.xlsx"));
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /Save As/);
  assert.equal(looksLikeCsv(file("members.xls")).ok, false);
  assert.equal(looksLikeCsv(file("book.numbers")).ok, false);
});

test("an empty file is refused with its own message", () => {
  const result = looksLikeCsv(file("members.csv", 0));
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /empty/i);
});

test("no size ceiling is applied unless the caller sets one", () => {
  const big = file("members.csv", 12 * 1024 * 1024);
  assert.equal(looksLikeCsv(big).ok, true);
  const capped = looksLikeCsv(big, { maxBytes: 10 * 1024 * 1024 });
  assert.equal(capped.ok, false);
  assert.match(capped.error ?? "", /12 MB.*10 MB/);
});

test("a file exactly on the ceiling is allowed", () => {
  assert.equal(looksLikeCsv(file("m.csv", 100), { maxBytes: 100 }).ok, true);
});

test("the accept attribute lists exactly what this check allows", () => {
  assert.equal(CSV_FILE_ACCEPT, ".csv,.tsv");
});
