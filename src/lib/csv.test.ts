import { test } from "node:test";
import assert from "node:assert/strict";
import { UTF8_BOM, toCsv } from "./csv";

test("only quotes cells that need it", () => {
  assert.equal(toCsv([["Dela Cruz"]]), "Dela Cruz");
  assert.equal(toCsv([["Dela Cruz, Juan"]]), '"Dela Cruz, Juan"');
  assert.equal(toCsv([['He said "hi"']]), '"He said ""hi"""');
  assert.equal(toCsv([["line\nbreak"]]), '"line\nbreak"');
});

// The escaper this module used to carry missed this case, so it is asserted
// here and not only in csv-escape.test.ts: the regression would reappear as a
// local copy, not as a change to the shared one.
test("a lone carriage return is quoted too, or the record splits in two", () => {
  assert.equal(toCsv([["line\rbreak"]]), '"line\rbreak"');
});

test("a null or undefined cell writes as blank, not as the word", () => {
  assert.equal(toCsv([["a", null, undefined, "b"]]), "a,,,b");
});

test("rows join with CRLF, which is what Excel reads", () => {
  assert.equal(toCsv([["a", "b"], ["c", "d"]]), "a,b\r\nc,d");
});

test("the BOM is a single U+FEFF — an escape that got typed literally would break Excel", () => {
  assert.equal(UTF8_BOM.length, 1);
  assert.equal(UTF8_BOM.charCodeAt(0), 0xfeff);
});
