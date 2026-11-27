import { test } from "node:test";
import assert from "node:assert/strict";
import { firstStepWithError, stepErrorsOf } from "@/lib/form-stepper";
import type { PlaceTimeDepositInput } from "@/types";
import { checkPlacement, type PlacementForm } from "./placement-form";
import { PLACEMENT_SENT_FIELDS, PLACEMENT_STEPS, placementErrors } from "./placement-steps";

const EMPTY: PlacementForm = {
  memberId: null,
  productId: "",
  term: "",
  placementDate: "",
  amount: "",
  instruction: "payout",
  method: "savings",
  fundingAccountId: "",
  payoutAccountId: "",
  reference: "",
};

function owners(field: string): number {
  return PLACEMENT_STEPS.filter((s) => (s.fields ?? []).some((f) => f === field || field.startsWith(`${f}.`))).length;
}

test("the steps, in order", () => {
  assert.deepEqual(
    PLACEMENT_STEPS.map((s) => s.title),
    ["Member & product", "Amount & payment", "Review"],
  );
});

test("every field the dialog sends belongs to exactly one step", () => {
  const sent: ReadonlyArray<keyof PlaceTimeDepositInput> = PLACEMENT_SENT_FIELDS;
  for (const field of sent) assert.equal(owners(field), 1, field);
});

test("the review step holds no field: it shows the server's figures", () => {
  assert.deepEqual(PLACEMENT_STEPS[2].fields, []);
});

test("every check the dialog makes belongs to exactly one step, in the dialog's words", () => {
  const { errors } = checkPlacement(EMPTY, null);
  const keyed = placementErrors(errors);
  for (const key of Object.keys(keyed)) assert.equal(owners(key), 1, key);
  assert.deepEqual(stepErrorsOf(keyed, PLACEMENT_STEPS[0]), {
    borrower_id: "Choose the member.",
    product_id: "Choose a time deposit product.",
    term_days: "Choose the term.",
  });
  assert.deepEqual(Object.keys(stepErrorsOf(keyed, PLACEMENT_STEPS[1])), [
    "principal",
    "placement_date",
    "funding_account_id",
  ]);
  assert.equal(stepErrorsOf(keyed, PLACEMENT_STEPS[1]).funding_account_id, "Choose the savings account that pays for it.");
});

test("a complete placement has no errors", () => {
  const form: PlacementForm = {
    ...EMPTY,
    memberId: 7,
    productId: "3",
    term: "90",
    placementDate: "2026-11-17",
    amount: "10000",
    method: "cash",
  };
  const { errors, body } = checkPlacement(form, { id: 3, term_options_days: [30, 90] });
  assert.deepEqual(placementErrors(errors), {});
  assert.ok(body);
});

test("a missing reference is the payment step's, in the server's words", () => {
  const form: PlacementForm = { ...EMPTY, method: "maya" };
  const keyed = placementErrors(checkPlacement(form, null).errors);
  assert.equal(stepErrorsOf(keyed, PLACEMENT_STEPS[1]).reference, "Enter the Maya reference for this time deposit.");
  assert.equal(owners("reference"), 1);
});

test("a 422 opens the step that holds its field", () => {
  assert.equal(firstStepWithError({ principal: ["Below the minimum."] }, PLACEMENT_STEPS), 1);
  assert.equal(firstStepWithError({ term_days: ["Not offered."] }, PLACEMENT_STEPS), 0);
  assert.equal(firstStepWithError({ payout_account_id: ["Closed."] }, PLACEMENT_STEPS), 1);
  assert.equal(firstStepWithError({ placement: ["Refused."] }, PLACEMENT_STEPS), -1);
});
