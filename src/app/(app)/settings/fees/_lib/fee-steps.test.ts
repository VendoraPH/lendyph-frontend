import { test } from "node:test";
import assert from "node:assert/strict";
import { firstStepWithError, stepIndexForField } from "@/lib/form-stepper";
import { buildFeePayload, EMPTY_FORMULA_FIELDS } from "@/lib/fee-form";
import { FEE_STEPS, FORMULA_CHECK_PENDING, feeStepErrors, type FeeStepInput } from "./fee-steps";

const fixed: FeeStepInput = {
  form: { name: "Notarial Fee", type: "fixed", value: "500", productIds: [], conditions: {}, formula: EMPTY_FORMULA_FIELDS },
  expressions: true,
  formulaCheckValid: false,
};

const written: FeeStepInput = {
  form: {
    ...fixed.form,
    type: "formula",
    value: "",
    formula: { perMonth: false, minAmount: "100", maxAmount: "1000", mode: "expression", expression: "Principal Amount * 1%" },
  },
  expressions: true,
  formulaCheckValid: true,
};

function stepsHolding(key: string): string[] {
  return FEE_STEPS.filter((s) => (s.fields ?? []).some((f) => key === f || key.startsWith(`${f}.`))).map((s) => s.id);
}

test("the fee dialog's steps are Details, Amount and Products", () => {
  assert.deepEqual(FEE_STEPS.map((s) => s.title), ["Details", "Amount", "Products"]);
});

test("every key a fee save sends belongs to exactly one step", () => {
  const payloads = [
    buildFeePayload({ ...fixed.form, productIds: [1], conditions: { term_days_gt: 30 } }, { expressions: true }),
    buildFeePayload({ ...written.form, productIds: [1], conditions: { loan_amount_lt: 9000 } }, { expressions: true }),
    buildFeePayload({ ...written.form, formula: { ...written.form.formula!, mode: "rate" }, value: "2" }, { expressions: true }),
  ];
  for (const result of payloads) {
    assert.ok("payload" in result);
    for (const key of Object.keys(result.payload)) {
      assert.equal(stepsHolding(key).length, 1, `${key} is in ${stepsHolding(key).join(", ") || "no step"}`);
    }
  }
});

test("a server 422 opens the step holding its field, dotted keys included", () => {
  const at = (key: string) => FEE_STEPS[stepIndexForField(key, FEE_STEPS)]?.id;
  assert.equal(at("name"), "details");
  assert.equal(at("type"), "details");
  assert.equal(at("value"), "amount");
  assert.equal(at("formula_expression"), "amount");
  assert.equal(at("min_amount"), "amount");
  assert.equal(at("per_month"), "amount");
  assert.equal(at("applicable_product_ids.0"), "products");
  assert.equal(at("conditions.term_days_gt"), "products");
  assert.equal(
    FEE_STEPS[firstStepWithError({ "conditions.loan_amount_eq": ["Bad."], formula_expression: ["Bad."] }, FEE_STEPS)].id,
    "amount",
  );
});

test("a complete fee passes every step", () => {
  for (const step of FEE_STEPS) {
    assert.deepEqual(feeStepErrors(step.id, fixed), {}, step.id);
    assert.deepEqual(feeStepErrors(step.id, written), {}, step.id);
  }
});

test("Details checks the name only, with the save's own message", () => {
  const input = { ...fixed, form: { ...fixed.form, name: " ", value: "" } };
  assert.deepEqual(feeStepErrors("details", input), { name: "Enter a fee name." });
});

test("Amount checks the amount or rate, whatever the name and conditions hold", () => {
  const input = { ...fixed, form: { ...fixed.form, name: "", value: "", conditions: { term_days_gt: 30, term_days_lt: 10 } } };
  assert.deepEqual(feeStepErrors("amount", input), { value: "Enter a fee amount or rate of zero or more." });
  const percent = { ...fixed, form: { ...fixed.form, type: "percentage" as const, value: "150" } };
  assert.deepEqual(feeStepErrors("amount", percent), { value: "A percentage fee cannot exceed 100% of the loan amount." });
});

test("Amount checks a formula fee's minimum and maximum, on the field that is wrong", () => {
  const withBounds = (minAmount: string, maxAmount: string) =>
    feeStepErrors("amount", { ...written, form: { ...written.form, formula: { ...written.form.formula!, minAmount, maxAmount } } });
  // A minimum above the maximum: the minimum's field.
  const above = withBounds("500", "100");
  assert.deepEqual(Object.keys(above), ["min_amount"]);
  assert.match(String(above.min_amount), /cannot be more than the maximum/);
  // A bad minimum: the minimum's field, whatever the maximum holds.
  assert.deepEqual(Object.keys(withBounds("1.234", "")), ["min_amount"]);
  assert.deepEqual(Object.keys(withBounds("1.234", "9.999")), ["min_amount"]);
  // A bad maximum: the maximum's field.
  const max = withBounds("100", "1.234");
  assert.deepEqual(Object.keys(max), ["max_amount"]);
  assert.match(String(max.max_amount), /^Maximum must be a peso amount/);
  assert.deepEqual(Object.keys(withBounds("", "-5")), ["max_amount"]);
});

test("a written formula is checked on its own field, and waits for the server's check", () => {
  const empty = { ...written, form: { ...written.form, formula: { ...written.form.formula!, expression: " " } } };
  assert.deepEqual(feeStepErrors("amount", empty), { formula_expression: "Write the fee formula." });
  // Next shows the step's check too, so its wait names no button; the save keeps its own message.
  assert.deepEqual(feeStepErrors("amount", { ...written, formulaCheckValid: false }), {
    formula_expression: "Wait for the formula check to pass.",
  });
  assert.equal(FORMULA_CHECK_PENDING, "Wait for the formula check to pass before saving.");
  // The rate recipe and the other types never wait on the check.
  const recipe = { ...written, formulaCheckValid: false, form: { ...written.form, value: "2", formula: { ...written.form.formula!, mode: "rate" as const } } };
  assert.deepEqual(feeStepErrors("amount", recipe), {});
  // With written formulas switched off, a formula fee is the rate recipe.
  assert.deepEqual(feeStepErrors("amount", { ...written, expressions: false, formulaCheckValid: false }), {
    value: "Enter a fee amount or rate of zero or more.",
  });
});

test("Products checks the conditions only, with the save's own message", () => {
  const input = { ...fixed, form: { ...fixed.form, name: "", value: "", conditions: { term_days_gt: 30, term_days_lt: 10 } } };
  const errors = feeStepErrors("products", input);
  assert.deepEqual(Object.keys(errors), ["conditions"]);
  assert.match(String(errors.conditions), /^Term days: "greater than" \(30\) must be below "less than" \(10\)/);
});
