import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { LoanProduct } from "@/types/loan";
import {
  EMPTY_FORM,
  PRODUCT_FIELD_LABELS,
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

// A product holding only the single charged fee (processing_fee 2.5, service_fee
// 1.5) has no range. The form filled the empty Min and Max from it, so any save
// wrote 2.5 and 1.5 into fields nobody had touched.
const NO_RANGE_PRODUCT = {
  ...STORED_PRODUCT,
  processing_fee: "2.5000",
  min_processing_fee: null,
  max_processing_fee: null,
  service_fee: "1.5000",
  min_service_fee: null,
  max_service_fee: null,
} as unknown as LoanProduct;

test("empty min and max fees open empty, not filled from the charged fee", () => {
  const form = productToForm(NO_RANGE_PRODUCT);
  assert.equal(form.min_processing_fee, "");
  assert.equal(form.max_processing_fee, "");
  assert.equal(form.min_service_fee, "");
  assert.equal(form.max_service_fee, "");
});

test("saving a product with empty min and max fees writes no fee into them", () => {
  const payload = formToApiPayload(productToForm(NO_RANGE_PRODUCT));
  assert.equal(payload.min_processing_fee, null);
  assert.equal(payload.max_processing_fee, null);
  assert.equal(payload.min_service_fee, null);
  assert.equal(payload.max_service_fee, null);
});

test("saving a product with no range leaves its charged fee alone", () => {
  const payload = formToApiPayload(productToForm(NO_RANGE_PRODUCT));
  assert.equal("processing_fee" in JSON.parse(JSON.stringify(payload)), false);
  assert.equal("service_fee" in JSON.parse(JSON.stringify(payload)), false);
});

test("a min or max fee the user set is sent as set, and zero is a value", () => {
  const payload = formToApiPayload({
    ...EMPTY_FORM,
    min_processing_fee: "1.125",
    max_processing_fee: "2.5",
    min_service_fee: "0",
    max_service_fee: "",
  });
  assert.equal(payload.min_processing_fee, 1.125);
  assert.equal(payload.max_processing_fee, 2.5);
  assert.equal(payload.processing_fee, 2.5);
  assert.equal(payload.min_service_fee, 0);
  assert.equal(payload.max_service_fee, null);
  assert.equal(payload.service_fee, undefined);
});

test("a stored range opens as stored, and clearing one end clears it", () => {
  const form = productToForm({
    ...NO_RANGE_PRODUCT,
    min_processing_fee: "1.0000",
    max_processing_fee: "2.5000",
    min_service_fee: "0.0000",
  } as unknown as LoanProduct);
  assert.equal(form.min_processing_fee, "1");
  assert.equal(form.max_processing_fee, "2.5");
  assert.equal(form.min_service_fee, "0");
  assert.equal(formToApiPayload({ ...form, min_processing_fee: "" }).min_processing_fee, null);
});

/**
 * The real load and save path, three times over: the edit form is built from
 * the list row (`productToForm`), saved (`formToApiPayload`), and the server
 * stores what was sent (a key that's absent keeps its value, null clears it)
 * and answers the row the list refetches. An untouched product must send null
 * for every empty fee bound on every save, and never take another product's.
 */
function serverUpdate(stored: Record<string, unknown>, payload: Record<string, unknown>) {
  const sent = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  const next = { ...stored, ...sent };
  for (const key of ["processing_fee", "min_processing_fee", "max_processing_fee", "service_fee", "min_service_fee", "max_service_fee"]) {
    if (next[key] !== null && next[key] !== undefined) next[key] = Number(next[key]).toFixed(4);
  }
  return next;
}

test("saving an untouched product three times sends null for every empty fee bound", () => {
  const OTHER = { ...STORED_PRODUCT, id: 8, min_service_fee: "1.5000", max_service_fee: "2.5000" } as unknown as LoanProduct;
  productToForm(OTHER);
  let stored: Record<string, unknown> = { ...(NO_RANGE_PRODUCT as unknown as Record<string, unknown>), processing_fee: "0.0000", service_fee: "0.0000" };
  for (let save = 1; save <= 3; save++) {
    const payload = formToApiPayload(productToForm(stored as unknown as LoanProduct)) as Record<string, unknown>;
    for (const key of ["min_processing_fee", "max_processing_fee", "min_service_fee", "max_service_fee"]) {
      assert.equal(payload[key], null, `save ${save}: ${key}`);
    }
    stored = serverUpdate(stored, payload);
  }
  assert.equal(stored.min_service_fee, null);
  assert.equal(stored.max_service_fee, null);
});

test("every form field has one label, and the form shows those labels", () => {
  for (const key of Object.keys(EMPTY_FORM)) {
    if (key === "grace_period_enabled") continue;
    assert.equal(typeof PRODUCT_FIELD_LABELS[key], "string", `no label for ${key}`);
  }
  assert.equal(PRODUCT_FIELD_LABELS.max_scb, "Maximum Share Capital Build-Up");
  const page = readFileSync(resolve(process.cwd(), "src/app/(app)/settings/loan-products/page.tsx"), "utf8");
  assert.doesNotMatch(page, /Minimum SCB|Maximum SCB/);
  assert.match(page, /PRODUCT_FIELD_LABELS\.max_scb/);
});
