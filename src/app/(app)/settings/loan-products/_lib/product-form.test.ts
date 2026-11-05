import { test } from "node:test";
import assert from "node:assert/strict";
import type { LoanProduct } from "@/types/loan";
import {
  EMPTY_FORM,
  defaultTermError,
  formToApiPayload,
  productToForm,
  retiredCustomFeesNotice,
} from "./product-form";

// Past Due Transfer was never stored: the backend has no such column and drops
// the keys, so the form saved a value that silently vanished. The field is
// removed, and the payload must not carry it whatever the form holds.
test("the product payload carries no past_due_transfer keys", () => {
  const form = {
    ...EMPTY_FORM,
    name: "Salary Loan",
    min_term: "3",
    max_term: "12",
    min_interest_rate: "2",
    max_interest_rate: "3",
    past_due_transfer_value: "30",
    past_due_transfer_unit: "days",
  };
  const keys = Object.keys(formToApiPayload(form));
  assert.deepEqual(
    keys.filter((k) => k.startsWith("past_due_transfer")),
    [],
  );
});

test("the product payload still carries the fields the backend stores", () => {
  const payload = formToApiPayload({
    ...EMPTY_FORM,
    name: "Salary Loan",
    min_term: "3",
    max_term: "12",
    min_interest_rate: "2",
    max_interest_rate: "3.5",
    penalty_rate: "1.25",
  });
  assert.equal(payload.name, "Salary Loan");
  assert.equal(payload.min_term, 3);
  assert.equal(payload.max_interest_rate, 3.5);
  assert.equal(payload.penalty_rate, 1.25);
  assert.equal(payload.grace_period_days, 0);
});

// Product "Additional Fees" are retired: Fees settings, scoped by product, is
// the single place fees are set up. The form never sends `custom_fees`, so the
// backend keeps a product's stored list untouched on create and update.
test("the product payload never carries custom_fees", () => {
  const form = {
    ...EMPTY_FORM,
    name: "Salary Loan",
    min_term: "3",
    max_term: "12",
    min_interest_rate: "2",
    max_interest_rate: "3",
    custom_fees: [{ name: "Handling", type: "fixed", value: "50" }],
  };
  assert.equal("custom_fees" in formToApiPayload(form), false);
  assert.equal("custom_fees" in formToApiPayload(EMPTY_FORM), false);
});

test("the retired-fees notice gives the count and names", () => {
  assert.equal(
    retiredCustomFeesNotice([
      { name: "Handling", type: "formula", value: 0.5 },
      { name: "Flat", type: "fixed", value: 50 },
    ]),
    "2 retired additional fees (Handling, Flat). They were never charged. Recreate any you need in Settings → Fees.",
  );
  assert.equal(
    retiredCustomFeesNotice([{ name: " Handling ", type: "fixed", value: 50 }]),
    "1 retired additional fee (Handling). They were never charged. Recreate any you need in Settings → Fees.",
  );
  assert.equal(
    retiredCustomFeesNotice([{ type: "fixed", value: 50 }, { name: "Flat" }]),
    "2 retired additional fees (Unnamed fee, Flat). They were never charged. Recreate any you need in Settings → Fees.",
  );
});

test("the retired-fees notice gives nothing for an empty or missing list", () => {
  assert.equal(retiredCustomFeesNotice([]), null);
  assert.equal(retiredCustomFeesNotice(undefined), null);
  assert.equal(retiredCustomFeesNotice(null), null);
  assert.equal(retiredCustomFeesNotice("not a list"), null);
});

// `loan_products` gains a description column: the form always had the field,
// but the payload dropped it, so what staff typed was lost on save.
test("the product payload carries the description, and clearing it sends null", () => {
  assert.equal(
    formToApiPayload({ ...EMPTY_FORM, description: " For salaried members " }).description,
    "For salaried members",
  );
  assert.equal(formToApiPayload({ ...EMPTY_FORM, description: "   " }).description, null);
});

// The payload sent no `term`, so the backend set the default term to max_term
// on every save: a product with 12 came back with 24.
const STORED_PRODUCT = {
  id: 7,
  name: "Salary Loan",
  description: "For salaried members",
  term: 12,
  min_term: 6,
  max_term: 24,
} as unknown as LoanProduct;

test("editing a product keeps its stored default term", () => {
  const form = productToForm(STORED_PRODUCT);
  assert.equal(form.term, "12");
  assert.equal(formToApiPayload(form).term, 12);
  assert.equal(form.description, "For salaried members");
});

test("a new product starts with no default term and must fill it in", () => {
  assert.equal(EMPTY_FORM.term, "");
  assert.equal(
    defaultTermError({ ...EMPTY_FORM, min_term: "6", max_term: "24" }),
    "Enter a Default Term between 6 and 24.",
  );
});

test("the default term must be a whole number between the minimum and maximum term", () => {
  const form = { ...EMPTY_FORM, min_term: "6", max_term: "24" };
  assert.equal(defaultTermError({ ...form, term: "6" }), null);
  assert.equal(defaultTermError({ ...form, term: "12" }), null);
  assert.equal(defaultTermError({ ...form, term: "24" }), null);
  assert.equal(defaultTermError({ ...form, term: "5" }), "Enter a Default Term between 6 and 24.");
  assert.equal(defaultTermError({ ...form, term: "25" }), "Enter a Default Term between 6 and 24.");
  assert.equal(defaultTermError({ ...form, term: "6.5" }), "Enter a Default Term between 6 and 24.");
});

test("lowering the maximum below a stored default term asks for a new one", () => {
  const form = { ...productToForm(STORED_PRODUCT), max_term: "10" };
  assert.equal(defaultTermError(form), "Enter a Default Term between 6 and 10.");
});
