import { test } from "node:test";
import assert from "node:assert/strict";
import { firstStepWithError, stepIndexForField } from "@/lib/form-stepper";
import { EMPTY_FORM, defaultTermError, formToApiPayload, type ProductForm } from "./product-form";
import { PRODUCT_STEPS, productStepCheck } from "./product-steps";

const filled: ProductForm = {
  ...EMPTY_FORM,
  name: "Salary Loan",
  min_amount: "5000",
  max_amount: "50000",
  min_term: "1",
  max_term: "24",
  term: "12",
  min_interest_rate: "1",
  max_interest_rate: "5",
};

function stepsHolding(field: string): string[] {
  return PRODUCT_STEPS.filter((s) => (s.fields ?? []).includes(field)).map((s) => s.id);
}

test("the loan product dialog has its sections as steps, in the form's order", () => {
  assert.deepEqual(
    PRODUCT_STEPS.map((s) => s.title),
    ["Basic Info", "Interest", "Fees & Penalties", "Share Capital Build-Up"],
  );
});

test("every field the form holds belongs to exactly one step", () => {
  for (const field of Object.keys(EMPTY_FORM)) {
    assert.equal(stepsHolding(field).length, 1, `${field} is in ${stepsHolding(field).join(", ") || "no step"}`);
  }
});

test("every key the save sends belongs to exactly one step", () => {
  const payload = formToApiPayload({ ...filled, grace_period_enabled: true, grace_period_days: "3", scb_required: true, min_scb: "100", max_scb: "1000" });
  for (const key of Object.keys(payload)) {
    assert.equal(stepsHolding(key).length, 1, `${key} is in ${stepsHolding(key).join(", ") || "no step"}`);
  }
});

test("a server 422 opens the step holding its field, dotted keys included", () => {
  const at = (key: string) => PRODUCT_STEPS[stepIndexForField(key, PRODUCT_STEPS)]?.id;
  assert.equal(at("name"), "basic");
  assert.equal(at("term"), "basic");
  assert.equal(at("term_unit"), "basic");
  assert.equal(at("max_interest_rate"), "interest");
  assert.equal(at("interest_rate"), "interest");
  assert.equal(at("frequencies.1"), "interest");
  assert.equal(at("frequency"), "interest");
  assert.equal(at("processing_fee"), "fees");
  assert.equal(at("notarial_fee"), "fees");
  assert.equal(at("grace_period_days"), "fees");
  assert.equal(at("custom_fees.0.name"), "fees");
  assert.equal(at("max_scb"), "scb");
  assert.equal(
    PRODUCT_STEPS[firstStepWithError({ max_scb: ["Too low."], max_interest_rate: ["Too high."] }, PRODUCT_STEPS)].id,
    "interest",
  );
});

test("every step passes a complete form", () => {
  for (const step of PRODUCT_STEPS) {
    assert.deepEqual(productStepCheck(step.id, filled), {}, step.id);
  }
});

test("a default term out of range fails Basic Info with the save's own message", () => {
  for (const term of ["30", "0", "1.5", ""]) {
    const form = { ...filled, term };
    assert.deepEqual(productStepCheck("basic", form), { term: defaultTermError(form) }, term);
  }
});

test("only Basic Info checks the term; the other steps leave their fields to the browser", () => {
  const form = { ...filled, term: "30", name: "", min_interest_rate: "", grace_period_enabled: true, scb_required: true };
  for (const step of PRODUCT_STEPS.filter((s) => s.id !== "basic")) {
    assert.deepEqual(productStepCheck(step.id, form), {}, step.id);
  }
});
