import { test } from "node:test";
import assert from "node:assert/strict";
import { borrowerLabel } from "./borrower-label";

test("prefers borrower_name when the backend sends one", () => {
  assert.equal(borrowerLabel({ borrower_id: 123, borrower_name: "Juan dela Cruz" }), "Juan dela Cruz");
});

test("falls back to the id literal when the field is absent", () => {
  assert.equal(borrowerLabel({ borrower_id: 123 }), "Borrower #123");
});

test("falls back when the field is null or empty rather than rendering a blank cell", () => {
  assert.equal(borrowerLabel({ borrower_id: 7, borrower_name: null }), "Borrower #7");
  assert.equal(borrowerLabel({ borrower_id: 7, borrower_name: "" }), "Borrower #7");
  assert.equal(borrowerLabel({ borrower_id: 7, borrower_name: "   " }), "Borrower #7");
});

test("trims surrounding whitespace off a real name", () => {
  assert.equal(borrowerLabel({ borrower_id: 9, borrower_name: "  Maria Santos \n" }), "Maria Santos");
});

test("a borrower id of 0 still labels rather than producing an empty string", () => {
  assert.equal(borrowerLabel({ borrower_id: 0 }), "Borrower #0");
});
