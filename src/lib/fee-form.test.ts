import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFeePayload } from "./fee-form";

const form = { name: " Release fee ", type: "fixed" as const, value: "500", productIds: [7], conditions: {} };

test("clearing conditions explicitly clears the saved backend rules", () => {
  assert.deepEqual(buildFeePayload(form), {
    payload: { name: "Release fee", type: "fixed", value: 500, applicable_product_ids: [7], conditions: null },
  });
});

test("preserves product selection and zero-valued conditions", () => {
  const result = buildFeePayload({ ...form, type: "percentage", value: "2.5", productIds: [7, 8], conditions: { loan_amount_gt: 0, term_days_eq: 30 } });
  assert.ok("payload" in result);
  assert.deepEqual(result.payload.conditions, { loan_amount_gt: 0, term_days_eq: 30 });
  assert.deepEqual(result.payload.applicable_product_ids, [7, 8]);
  assert.equal(result.payload.value, 2.5);
});

test("empty product selection retains the documented all-products scope", () => {
  const result = buildFeePayload({ ...form, productIds: [] });
  assert.ok("payload" in result);
  assert.deepEqual(result.payload.applicable_product_ids, []);
});

test("rejects blank, negative and non-finite fee amounts", () => {
  for (const value of ["", " ", "-1", "NaN", "Infinity"]) {
    assert.ok("error" in buildFeePayload({ ...form, value }), value);
  }
  assert.ok("payload" in buildFeePayload({ ...form, value: "0" }));
});

test("rejects negative conditions and fractional term days", () => {
  for (const conditions of [{ term_days_eq: 1.5 }, { loan_amount_gt: -1 }, { term_days_lt: Infinity }]) {
    assert.ok("error" in buildFeePayload({ ...form, conditions }));
  }
});

test("rejects impossible strict condition ranges", () => {
  for (const conditions of [
    { term_days_gt: 30, term_days_lt: 30 },
    { loan_amount_gt: 100, loan_amount_eq: 100 },
    { term_days_lt: 30, term_days_eq: 30 },
  ]) assert.ok("error" in buildFeePayload({ ...form, conditions }));
});

// The API caps `value` at `min:0` and nothing downstream re-checks it, so a
// percentage typed as "500" would be charged as 500% of the principal at
// release. This module is the only thing standing between the two.
test("rejects a percentage above 100% but allows the same number as a fixed fee", () => {
  const percentage = buildFeePayload({ ...form, type: "percentage", value: "500" });
  assert.ok("error" in percentage);
  assert.match(percentage.error, /100%/);

  assert.ok("payload" in buildFeePayload({ ...form, type: "percentage", value: "100" }));
  assert.ok("payload" in buildFeePayload({ ...form, type: "percentage", value: "2.5" }));
  // 500 pesos is an ordinary fixed fee; the ceiling is about the unit, not the digits.
  assert.ok("payload" in buildFeePayload({ ...form, type: "fixed", value: "500" }));
});

// A contradictory pair is storable on the API and simply never matches, so the
// check stays — but it has to say WHICH two numbers, or an already-saved fee
// looks un-editable: no unrelated edit gets past a message that names nothing.
test("a conflict error names the field and both offending values", () => {
  const result = buildFeePayload({ ...form, conditions: { term_days_gt: 30, term_days_eq: 30 } });
  assert.ok("error" in result);
  assert.match(result.error, /Term days/);
  assert.match(result.error, /equal to/);
  assert.match(result.error, /greater than/);
  assert.match(result.error, /30/);

  const amount = buildFeePayload({ ...form, conditions: { loan_amount_gt: 5000, loan_amount_lt: 1000 } });
  assert.ok("error" in amount);
  assert.match(amount.error, /Loan amount/);
  assert.match(amount.error, /5000/);
  assert.match(amount.error, /1000/);
});

// The flip side of the check: a satisfiable pair must still save, otherwise
// "name the field" would just be a friendlier way of being un-editable.
test("satisfiable gt/lt/eq combinations still save", () => {
  for (const conditions of [
    { term_days_gt: 30, term_days_eq: 60 },
    { term_days_lt: 90, term_days_eq: 60 },
    { loan_amount_gt: 1000, loan_amount_lt: 5000 },
    { term_days_gt: 30, loan_amount_lt: 5000 },
  ]) assert.ok("payload" in buildFeePayload({ ...form, conditions }), JSON.stringify(conditions));
});
