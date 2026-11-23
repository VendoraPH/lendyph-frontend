import { test } from "node:test";
import assert from "node:assert/strict";
import { termText, termUnitOf } from "./term";

test("a term reads in words with its unit", () => {
  assert.equal(termText(6, "months"), "6 months");
  assert.equal(termText(1, "months"), "1 month");
  assert.equal(termText(30, "days"), "30 days");
  assert.equal(termText(1, "days"), "1 day");
  assert.equal(termText(4, "weeks"), "4 weeks");
  assert.equal(termText(1, "weeks"), "1 week");
});

test("a term with no unit reads in months, the server's default for a product with none", () => {
  assert.equal(termText(12, undefined), "12 months");
  assert.equal(termText(12, null), "12 months");
  assert.equal(termText(null, "months"), null);
});

test("the unit is the loan product's", () => {
  const products = [
    { id: 1, term_unit: "days" as const },
    { id: 2, term_unit: "months" as const },
    { id: 3 },
  ];
  assert.equal(termUnitOf(products, 1), "days");
  assert.equal(termUnitOf(products, 2), "months");
  assert.equal(termUnitOf(products, 3), undefined);
  assert.equal(termUnitOf(products, 9), undefined);
  assert.equal(termUnitOf(products, null), undefined);
});
