import { test } from "node:test";
import assert from "node:assert/strict";
import { csvEscape, csvRow, neutraliseCsvFormula } from "./csv-escape";

// --- quoting ------------------------------------------------------------------

test("a value with nothing special in it is left alone", () => {
  assert.equal(csvEscape("Dela Cruz"), "Dela Cruz");
  assert.equal(csvEscape(""), "");
  assert.equal(csvEscape("₱352,800.00".replace(",", "")), "₱352800.00");
});

test("commas and quotes are quoted, and inner quotes doubled", () => {
  assert.equal(csvEscape("12,500.00"), '"12,500.00"');
  assert.equal(csvEscape('Juan "Boy" Dela Cruz'), '"Juan ""Boy"" Dela Cruz"');
});

test("a newline is quoted so it cannot end the record", () => {
  assert.equal(csvEscape("Purok 3\nBrgy. Poblacion"), '"Purok 3\nBrgy. Poblacion"');
});

// The reason this module exists rather than two near-copies: one copy handled
// \n only, so a lone CR ended the record and shifted every column after it into
// the wrong heading — a file that opens, and is silently wrong.
test("a lone carriage return is quoted too", () => {
  assert.equal(csvEscape("a\rb"), '"a\rb"');
  assert.equal(csvEscape("a\r\nb"), '"a\r\nb"');
});

test("a row joins with commas and renders a missing cell as empty, not 'null'", () => {
  assert.equal(csvRow(["a", null, undefined, "d"]), "a,,,d");
  assert.equal(csvRow(["a,b", 'c"d']), '"a,b","c""d"');
});

// --- the formula guard --------------------------------------------------------

// Character for character from CsvExportTrait::streamCsv in the API. The prefix
// is apostrophe + TAB, and it is the same six triggers, so a cell exported by
// the server and the same cell exported by the client look identical.
test("the four formula leaders are prefixed with apostrophe-tab", () => {
  for (const lead of ["=", "+", "-", "@"]) {
    assert.equal(neutraliseCsvFormula(`${lead}SUM(A1)`), `'\t${lead}SUM(A1)`);
  }
});

test("a leading tab or CR is a trigger too, because Excel skips them", () => {
  assert.equal(neutraliseCsvFormula("\t=cmd|'/c calc'!A0"), "'\t\t=cmd|'/c calc'!A0");
  assert.equal(neutraliseCsvFormula("\r=1+1"), "'\t\r=1+1");
});

test("only the FIRST character triggers it", () => {
  // Otherwise every "3 = 4" and every "a+b" in a message would be mangled.
  assert.equal(neutraliseCsvFormula("Amount = 500"), "Amount = 500");
  assert.equal(neutraliseCsvFormula("a+b"), "a+b");
  assert.equal(neutraliseCsvFormula(""), "");
  assert.equal(neutraliseCsvFormula("31/02/1988"), "31/02/1988");
});

// The reason the guard is NOT folded into csvEscape. The reports exporter runs
// every financial figure through the escaper, and negative currency leads with
// a minus: neutralising by default would print '\t-352,800.00 in every report
// in the app.
test("escaping alone never neutralises, so negative currency survives a report", () => {
  assert.equal(csvEscape("-352,800.00"), '"-352,800.00"');
  assert.equal(csvRow(["Net", "-352800.00"]), "Net,-352800.00");
});

test("neutralising and quoting compose, in that order", () => {
  // The prefix goes on first, then the whole thing is quoted as one cell.
  assert.equal(csvRow([neutraliseCsvFormula("=1,2")]), `"'\t=1,2"`);
});
