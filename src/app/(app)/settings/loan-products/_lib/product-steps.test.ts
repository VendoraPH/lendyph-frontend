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

test("a step passes when none of its own controls is invalid and the term is in range", () => {
  for (const step of PRODUCT_STEPS) {
    assert.deepEqual(productStepCheck(step.id, filled, {}), { errors: {}, toast: null }, step.id);
  }
});

test("a step fails on the browser's own check of its controls, shown by the browser", () => {
  const check = productStepCheck("basic", { ...filled, name: "" }, { name: "Please fill out this field." });
  assert.deepEqual(check, { errors: { name: "Please fill out this field." }, toast: null });
});

test("another step's invalid controls never fail this one", () => {
  assert.deepEqual(productStepCheck("interest", filled, { name: "Please fill out this field." }).errors, {});
  assert.deepEqual(productStepCheck("basic", filled, { min_scb: "Please fill out this field." }).errors, {});
});

test("a default term out of range fails Basic Info with today's message, as a toast", () => {
  const form = { ...filled, term: "30" };
  const check = productStepCheck("basic", form, {});
  assert.deepEqual(check, { errors: { term: defaultTermError(form) }, toast: defaultTermError(form) });
  // The browser's checks come first, as they did before the save ran.
  assert.equal(productStepCheck("basic", form, { name: "Please fill out this field." }).toast, null);
  // Only Basic Info holds the term.
  assert.deepEqual(productStepCheck("interest", form, {}).errors, {});
});

test("grace days and the build-up range are checked only while they are switched on", () => {
  // The inputs exist (and are required) only while switched on, so only then
  // can the browser report them; the step reads whatever the browser reports.
  assert.deepEqual(productStepCheck("fees", { ...filled, grace_period_enabled: false }, {}).errors, {});
  assert.deepEqual(
    productStepCheck("fees", { ...filled, grace_period_enabled: true }, { grace_period_days: "Please fill out this field." }).errors,
    { grace_period_days: "Please fill out this field." },
  );
  assert.deepEqual(
    productStepCheck("scb", { ...filled, scb_required: true }, { min_scb: "Please fill out this field." }).errors,
    { min_scb: "Please fill out this field." },
  );
});
