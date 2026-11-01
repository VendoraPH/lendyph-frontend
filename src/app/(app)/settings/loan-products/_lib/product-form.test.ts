import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_FORM, formToApiPayload } from "./product-form";

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
