import { test } from "node:test";
import assert from "node:assert/strict";
import { firstStepWithError, stepErrorsOf, stepIndexForField } from "@/lib/form-stepper";
import {
  OPEN_ACCOUNT_SENT_FIELDS,
  OPEN_ACCOUNT_STEPS,
  openAccountErrors,
  type OpenAccountCheck,
} from "./open-account-steps";
import { serverStepErrors } from "./step-errors";

const NOTHING_OK: OpenAccountCheck = {
  memberError: "Choose the member.",
  productError: "Choose a savings product.",
  dateError: "Enter the opening date.",
  amountError: "Enter the opening deposit.",
  sourceError: "Source of funds: say where the money comes from",
};

const ALL_OK: OpenAccountCheck = {
  memberError: null,
  productError: null,
  dateError: null,
  amountError: null,
  sourceError: null,
};

function owners(field: string): number {
  return OPEN_ACCOUNT_STEPS.filter((s) => (s.fields ?? []).some((f) => f === field || field.startsWith(`${f}.`)))
    .length;
}

test("the steps, in order", () => {
  assert.deepEqual(
    OPEN_ACCOUNT_STEPS.map((s) => s.title),
    ["Member & product", "Opening deposit", "Opening details"],
  );
});

test("every field the dialog sends belongs to exactly one step", () => {
  for (const field of OPEN_ACCOUNT_SENT_FIELDS) assert.equal(owners(field), 1, field);
});

test("every check the dialog makes belongs to exactly one step", () => {
  for (const key of Object.keys(openAccountErrors(NOTHING_OK))) assert.equal(owners(key), 1, key);
});

test("no field is listed on two steps", () => {
  const listed = OPEN_ACCOUNT_STEPS.flatMap((s) => s.fields ?? []);
  assert.equal(new Set(listed).size, listed.length);
});

test("each step checks only its own fields, with the dialog's words", () => {
  const errors = openAccountErrors(NOTHING_OK);
  assert.deepEqual(stepErrorsOf(errors, OPEN_ACCOUNT_STEPS[0]), {
    borrower_id: "Choose the member.",
    product_id: "Choose a savings product.",
  });
  assert.deepEqual(stepErrorsOf(errors, OPEN_ACCOUNT_STEPS[1]), {
    opened_at: "Enter the opening date.",
    initial_deposit: "Enter the opening deposit.",
  });
  assert.deepEqual(stepErrorsOf(errors, OPEN_ACCOUNT_STEPS[2]), {
    source_of_funds_other: "Source of funds: say where the money comes from",
  });
});

test("a complete dialog has no errors", () => {
  assert.deepEqual(openAccountErrors(ALL_OK), {});
});

test("a 422 opens the step that holds its field, dotted keys included", () => {
  assert.equal(firstStepWithError({ initial_deposit: ["Too low."] }, OPEN_ACCOUNT_STEPS), 1);
  assert.equal(firstStepWithError({ "beneficiary.contact_number": ["Invalid."] }, OPEN_ACCOUNT_STEPS), 2);
  assert.equal(stepIndexForField("product_id", OPEN_ACCOUNT_STEPS), 0);
  assert.equal(
    firstStepWithError({ reference: ["Too long."], borrower_id: ["Not a member."] }, OPEN_ACCOUNT_STEPS),
    0,
  );
});

test("a refusal that names no field leaves the open step alone", () => {
  assert.equal(firstStepWithError({ account: ["Not allowed."] }, OPEN_ACCOUNT_STEPS), -1);
});

test("only a 422 carries field errors", () => {
  const unprocessable = { response: { status: 422, data: { errors: { opened_at: ["In the future."], x: "no" } } } };
  assert.deepEqual(serverStepErrors(unprocessable), { opened_at: ["In the future."] });
  assert.deepEqual(serverStepErrors({ response: { status: 409, data: { errors: { opened_at: ["x"] } } } }), {});
  assert.deepEqual(serverStepErrors(new Error("offline")), {});
  assert.deepEqual(serverStepErrors(null), {});
});
