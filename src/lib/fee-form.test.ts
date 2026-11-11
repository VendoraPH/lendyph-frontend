import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFeePayload, buildFormulaFields, describeFormulaFee, EMPTY_FORMULA_FIELDS, FORMULA_FEE_HELP } from "./fee-form";

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

// Fee type "formula" (decision 5e): a rate of the principal, optionally per
// month of the term, kept between optional peso bounds. The server computes
// the amount; the form only sends the rule.
const formula = { perMonth: true, minAmount: "150", maxAmount: "1500.50" };

test("a formula fee sends its rate, per-month flag and peso bounds", () => {
  assert.deepEqual(buildFeePayload({ ...form, type: "formula", value: "1.5", formula }), {
    payload: {
      name: "Release fee", type: "formula", value: 1.5,
      per_month: true, min_amount: 150, max_amount: 1500.5,
      applicable_product_ids: [7], conditions: null,
    },
  });
});

test("blank formula bounds are sent as none", () => {
  const result = buildFeePayload({ ...form, type: "formula", value: "1", formula: { perMonth: false, minAmount: " ", maxAmount: "" } });
  assert.ok("payload" in result);
  assert.equal(result.payload.per_month, false);
  assert.equal(result.payload.min_amount, null);
  assert.equal(result.payload.max_amount, null);
});

test("fixed and percentage fees send no formula fields", () => {
  for (const type of ["fixed", "percentage"] as const) {
    const result = buildFeePayload({ ...form, type, value: "2", formula });
    assert.ok("payload" in result);
    assert.equal("per_month" in result.payload, false, type);
    assert.equal("min_amount" in result.payload, false, type);
  }
});

test("a formula rate is a percentage, capped at 100%", () => {
  const result = buildFeePayload({ ...form, type: "formula", value: "150", formula });
  assert.ok("error" in result);
  assert.match(result.error, /100%/);
});

test("a minimum above the maximum is refused, naming both in pesos", () => {
  const result = buildFeePayload({ ...form, type: "formula", value: "1", formula: { perMonth: false, minAmount: "500", maxAmount: "100" } });
  assert.ok("error" in result);
  assert.match(result.error, /₱500\.00/);
  assert.match(result.error, /₱100\.00/);
  assert.ok("fields" in buildFormulaFields({ perMonth: false, minAmount: "100", maxAmount: "100" }));
});

test("bounds must be zero or more with at most two decimals", () => {
  for (const minAmount of ["-1", "10.005", "abc", "1e3"]) {
    assert.ok("error" in buildFormulaFields({ perMonth: false, minAmount, maxAmount: "" }), minAmount);
  }
  for (const maxAmount of ["-0.01", "1.234"]) {
    assert.ok("error" in buildFormulaFields({ perMonth: false, minAmount: "", maxAmount }), maxAmount);
  }
  assert.deepEqual(buildFormulaFields({ perMonth: false, minAmount: "0", maxAmount: "10.5" }), {
    fields: { per_month: false, min_amount: 0, max_amount: 10.5 },
  });
});

test("a formula fee reads as its rule, in pesos", () => {
  assert.equal(describeFormulaFee({ value: "1.5000", per_month: true, min_amount: 150, max_amount: "1500.50" }), "1.5% per month · min ₱150.00 · max ₱1,500.50");
  assert.equal(describeFormulaFee({ value: 2, per_month: false, min_amount: null, max_amount: null }), "2%");
});

test("the help line says what a formula does", () => {
  assert.equal(FORMULA_FEE_HELP, "Percentage of principal, optionally per month of the term, kept between the minimum and maximum.");
});

test("a written formula is checked, normalised and replaces the rate", () => {
  const result = buildFeePayload(
    { ...form, type: "formula", value: "", formula: { ...EMPTY_FORMULA_FIELDS, mode: "expression", expression: "(principal amount*2.5%)/365", maxAmount: "500" } },
    { expressions: true },
  );
  assert.ok("payload" in result);
  assert.equal(result.payload.value, 0);
  assert.equal(result.payload.per_month, false);
  assert.equal(result.payload.max_amount, 500);
  assert.equal(result.payload.formula_expression, "(Principal Amount * 2.5%) / 365");
});

test("an invalid written formula is refused with its reason", () => {
  const result = buildFeePayload(
    { ...form, type: "formula", value: "", formula: { ...EMPTY_FORMULA_FIELDS, mode: "expression", expression: "Salary * 2" } },
    { expressions: true },
  );
  assert.ok("error" in result);
  assert.match(result.error, /^Fee formula: "Salary" is not a variable/);
});

test("the rate recipe clears a saved expression only where expressions are on", () => {
  const input = { ...form, type: "formula" as const, value: "2", formula: { ...EMPTY_FORMULA_FIELDS, mode: "rate" as const } };
  const on = buildFeePayload(input, { expressions: true });
  assert.ok("payload" in on);
  assert.equal(on.payload.formula_expression, null);
  const off = buildFeePayload(input);
  assert.ok("payload" in off);
  assert.equal("formula_expression" in off.payload, false);
});

test("a written formula reads as itself in the list", () => {
  assert.equal(
    describeFormulaFee({ value: 0, formula_expression: "Principal Amount * 1%", min_amount: 100 }),
    "Principal Amount * 1% · min ₱100.00",
  );
});
