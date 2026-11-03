import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_FORM, formToApiPayload, retiredCustomFeesNotice } from "./product-form";

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
