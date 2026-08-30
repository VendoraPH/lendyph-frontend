import { test } from "node:test";
import assert from "node:assert/strict";
import { UTF8_BOM, escapeCsvCell, toCsv, toCsvRow } from "./csv";

test("only quotes cells that need it", () => {
  assert.equal(escapeCsvCell("Dela Cruz"), "Dela Cruz");
  assert.equal(escapeCsvCell("Dela Cruz, Juan"), '"Dela Cruz, Juan"');
  assert.equal(escapeCsvCell('He said "hi"'), '"He said ""hi"""');
  assert.equal(escapeCsvCell("line\nbreak"), '"line\nbreak"');
});

test("a null or undefined cell writes as blank, not as the word", () => {
  assert.equal(toCsvRow(["a", null, undefined, "b"]), "a,,,b");
});

test("rows join with CRLF, which is what Excel reads", () => {
  assert.equal(toCsv([["a", "b"], ["c", "d"]]), "a,b\r\nc,d");
});

test("the BOM is a single U+FEFF — an escape that got typed literally would break Excel", () => {
  assert.equal(UTF8_BOM.length, 1);
  assert.equal(UTF8_BOM.charCodeAt(0), 0xfeff);
});
