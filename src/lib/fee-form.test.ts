import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFeeFormulaCheckRequest, buildFeePayload, buildFormulaFields, DEFAULT_FORMULA_SAMPLE, describeFormulaFee,
  describeFormulaInputs, describeFormulaSnapshot, EMPTY_FORMULA_FIELDS, FEE_FORMULA_VARIABLES, FORMULA_FEE_HELP,
  formulaExpressionError,
} from "./fee-form";

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

test("a written formula is sent as written, trimmed, and replaces the rate", () => {
  const result = buildFeePayload(
    { ...form, type: "formula", value: "", formula: { ...EMPTY_FORMULA_FIELDS, perMonth: true, mode: "expression", expression: "  (principal amount*2.5%)/365 ", maxAmount: "500" } },
    { expressions: true },
  );
  assert.ok("payload" in result);
  assert.equal(result.payload.value, 0);
  assert.equal(result.payload.per_month, false);
  assert.equal(result.payload.max_amount, 500);
  assert.equal(result.payload.formula_expression, "(principal amount*2.5%)/365");
});

test("the browser never judges a formula: an unknown variable is left to the server", () => {
  const result = buildFeePayload(
    { ...form, type: "formula", value: "", formula: { ...EMPTY_FORMULA_FIELDS, mode: "expression", expression: "Principle * 2" } },
    { expressions: true },
  );
  assert.ok("payload" in result);
  assert.equal(result.payload.formula_expression, "Principle * 2");
});

test("a blank or too-long written formula is refused before sending", () => {
  const blank = buildFeePayload(
    { ...form, type: "formula", value: "", formula: { ...EMPTY_FORMULA_FIELDS, mode: "expression", expression: "   " } },
    { expressions: true },
  );
  assert.deepEqual(blank, { error: "Write the fee formula." });
  const long = buildFeePayload(
    { ...form, type: "formula", value: "", formula: { ...EMPTY_FORMULA_FIELDS, mode: "expression", expression: "1+".repeat(128) + "1" } },
    { expressions: true },
  );
  assert.ok("error" in long);
});

test("with expressions off, a formula fee is today's rate recipe and sends no expression", () => {
  const input = { ...form, type: "formula" as const, value: "2", formula: { ...EMPTY_FORMULA_FIELDS, mode: "expression" as const, expression: "Loan Term * 10" } };
  const off = buildFeePayload(input);
  assert.ok("payload" in off);
  assert.equal(off.payload.value, 2);
  assert.equal("formula_expression" in off.payload, false);
});

test("the rate recipe and the other types clear a saved expression only where expressions are on", () => {
  const recipe = { ...form, type: "formula" as const, value: "2", formula: { ...EMPTY_FORMULA_FIELDS, mode: "rate" as const } };
  const on = buildFeePayload(recipe, { expressions: true });
  assert.ok("payload" in on);
  assert.equal(on.payload.formula_expression, null);
  assert.equal(on.payload.value, 2);
  const fixedOn = buildFeePayload(form, { expressions: true });
  assert.ok("payload" in fixedOn);
  assert.equal(fixedOn.payload.formula_expression, null);
  const fixedOff = buildFeePayload(form);
  assert.ok("payload" in fixedOff);
  assert.equal("formula_expression" in fixedOff.payload, false);
});

test("a written formula reads as itself in the list, never 0%", () => {
  assert.equal(
    describeFormulaFee({ value: 0, formula_expression: "Principal Amount * 1%", min_amount: 100 }),
    "Principal Amount * 1% · min ₱100.00",
  );
});

test("every variable has a hint in words: the rate's period, months and calendar days", () => {
  assert.deepEqual(FEE_FORMULA_VARIABLES.map((v) => v.label), [
    "Principal Amount", "Loan Amount", "Interest Rate", "Loan Term", "Term in Days",
  ]);
  const hint = (label: string) => FEE_FORMULA_VARIABLES.find((v) => v.label === label)?.hint ?? "";
  assert.match(hint("Interest Rate"), /per the loan's own rate period/);
  assert.match(hint("Loan Term"), /in months.*days ÷ 30/);
  assert.match(hint("Term in Days"), /Calendar days from the loan's start date to its maturity date/);
});

test("the formula check sends the formula, the sample loan and the bounds as typed", () => {
  const result = buildFeeFormulaCheckRequest(" Loan Term * 10 ", DEFAULT_FORMULA_SAMPLE, { minAmount: "100", maxAmount: "abc" });
  assert.deepEqual(result, {
    body: {
      formula_expression: "Loan Term * 10",
      principal_amount: "100000.00",
      interest_rate: "3",
      interest_rate_frequency: "monthly",
      term: 12,
      term_unit: "months",
      min_amount: "100",
      max_amount: null,
    },
  });
});

test("the formula check waits for a formula and a well-formed sample loan", () => {
  assert.equal(buildFeeFormulaCheckRequest("  ", DEFAULT_FORMULA_SAMPLE, { minAmount: "", maxAmount: "" }), null);
  for (const sample of [
    { ...DEFAULT_FORMULA_SAMPLE, principalAmount: "1,000" },
    { ...DEFAULT_FORMULA_SAMPLE, interestRate: "three" },
    { ...DEFAULT_FORMULA_SAMPLE, term: "1.5" },
    { ...DEFAULT_FORMULA_SAMPLE, term: "0" },
  ]) {
    const result = buildFeeFormulaCheckRequest("Loan Term", sample, { minAmount: "", maxAmount: "" });
    assert.ok(result && "error" in result, JSON.stringify(sample));
  }
});

test("a save refusal on the formula is shown as the server sent it", () => {
  const message = "A bracket is opened and never closed.";
  assert.equal(formulaExpressionError({ response: { status: 422, data: { errors: { formula_expression: [message] } } } }), message);
  assert.equal(formulaExpressionError({ response: { status: 422, data: { errors: { name: ["Taken."] } } } }), null);
  assert.equal(formulaExpressionError({ response: { status: 500, data: {} } }), null);
  assert.equal(formulaExpressionError(new Error("x")), null);
});

const INPUTS = {
  principal_amount: "100000.00", loan_amount: "100000.00",
  interest_rate: "3.0000", interest_rate_frequency: "monthly",
  loan_term: "12", term_in_days: "365",
};

test("a formula snapshot reads in words: pesos, the rate per its period, months and days", () => {
  assert.deepEqual(describeFormulaInputs(INPUTS), [
    "Principal Amount and Loan Amount ₱100,000.00",
    "Interest Rate 3% per month",
    "Loan Term 12 months",
    "Term in Days 365 days",
  ]);
  assert.deepEqual(
    describeFormulaInputs({ ...INPUTS, loan_amount: "90000.50", interest_rate: "1.25", interest_rate_frequency: "semi_monthly", loan_term: "1.5", term_in_days: "1" }),
    [
      "Principal Amount ₱100,000.00",
      "Loan Amount ₱90,000.50",
      "Interest Rate 1.25% per semi-monthly period",
      "Loan Term 1.5 months",
      "Term in Days 1 day",
    ],
  );
});

test("a formula snapshot never shows a raw key", () => {
  const view = describeFormulaSnapshot({ formula_expression: "(Principal Amount * 2.5%) / 365", formula_inputs: { ...INPUTS, interest_rate_frequency: "fortnightly_custom" }, raw_amount: "6.849315" });
  assert.ok(view);
  assert.equal(view.formula, "(Principal Amount * 2.5%) / 365");
  assert.equal(view.beforeRounding, "₱6.849315");
  const text = [view.formula, ...view.figures, view.beforeRounding].join(" ");
  for (const key of [...Object.keys(INPUTS), "fortnightly_custom", "monthly", "raw_amount"]) {
    assert.equal(text.includes(key), false, key);
  }
  assert.ok(view.figures.includes("Interest Rate 3%"));
});

test("a line with no written formula has no snapshot", () => {
  assert.equal(describeFormulaSnapshot({}), null);
  assert.equal(describeFormulaSnapshot({ formula_expression: " ", raw_amount: "1.00" }), null);
  assert.equal(describeFormulaSnapshot({ formula_expression: "Loan Term", formula_inputs: null })?.figures.length, 0);
});
