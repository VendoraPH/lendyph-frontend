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
