import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_FEE, EMPTY_FORM, formToApiPayload } from "./product-form";
import { customFormulaFeesError } from "@/lib/fee-form";

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

// Decision 5e: a product custom fee can be a formula, sent with its per-month
// flag and peso bounds; the other types send only what they always did.
test("a custom formula fee carries its per-month flag and bounds", () => {
  const payload = formToApiPayload({
    ...EMPTY_FORM,
    name: "Salary Loan",
    custom_fees: [
      { ...EMPTY_FEE, name: "Handling", type: "formula", value: "0.5", per_month: true, min_amount: "100", max_amount: "250.50" },
      { ...EMPTY_FEE, name: "Flat", type: "fixed", value: "50", per_month: true, min_amount: "1" },
    ],
  });
  assert.deepEqual(payload.custom_fees, [
    { name: "Handling", type: "formula", value: 0.5, per_month: true, min_amount: 100, max_amount: 250.5 },
    { name: "Flat", type: "fixed", value: 50 },
  ]);
});

test("a custom formula fee with a minimum above its maximum is named in the error", () => {
  const fees = [
    { ...EMPTY_FEE, name: "Flat", type: "fixed" as const, value: "50", min_amount: "9", max_amount: "1" },
    { ...EMPTY_FEE, name: "Handling", type: "formula" as const, value: "0.5", min_amount: "300", max_amount: "100" },
  ];
  assert.match(customFormulaFeesError(fees) ?? "", /^Handling: The minimum \(₱300\.00\)/);
  assert.equal(customFormulaFeesError([{ ...fees[1], max_amount: "" }]), null);
  assert.equal(customFormulaFeesError([fees[0]]), null);
});
