import { test } from "node:test";
import assert from "node:assert/strict";
import { firstStepWithError, stepErrorsOf, stepIndexForField } from "@/lib/form-stepper";
import {
  RESTRUCTURE_SENT_FIELDS,
  RESTRUCTURE_STEPS,
  restructureMissing,
  type RestructureCheck,
} from "./restructure-steps";

const NOTHING_OK: RestructureCheck = {
  hasMember: false,
  hasSourceLoan: false,
  hasProduct: false,
  principalOk: false,
  termOk: false,
  hasFrequency: false,
  rateOk: false,
  hasRestructureDate: false,
  remarksMissing: true,
};

const ALL_OK: RestructureCheck = {
  hasMember: true,
  hasSourceLoan: true,
  hasProduct: true,
  principalOk: true,
  termOk: true,
  hasFrequency: true,
  rateOk: true,
  hasRestructureDate: true,
  remarksMissing: false,
};

function ownerCount(field: string): number {
  return RESTRUCTURE_STEPS.filter((s) =>
    (s.fields ?? []).some((f) => f === field || field.startsWith(`${f}.`)),
  ).length;
}

test("the steps follow the form's cards, in order", () => {
  assert.deepEqual(
    RESTRUCTURE_STEPS.map((s) => s.title),
    ["Source Loan", "Loan Product & Terms", "Collaterals", "Deductions", "Remarks & Policy Exception"],
  );
});

test("every field the restructure sends belongs to exactly one step", () => {
  for (const field of RESTRUCTURE_SENT_FIELDS) {
    assert.equal(ownerCount(field), 1, field);
  }
});

test("every check the form makes belongs to exactly one step", () => {
  for (const key of Object.keys(restructureMissing(NOTHING_OK))) {
    assert.equal(ownerCount(key), 1, key);
  }
});

test("no field is listed on two steps", () => {
  const listed = RESTRUCTURE_STEPS.flatMap((s) => s.fields ?? []);
  assert.equal(new Set(listed).size, listed.length);
});

test("the checks keep the form's labels and their order", () => {
  assert.deepEqual(Object.values(restructureMissing(NOTHING_OK)), [
    "Member",
    "Source loan",
    "Loan product",
    "Loan amount",
    "Term",
    "Payment frequency",
    "Interest rate",
    "Restructure date",
    "Remarks",
  ]);
  assert.deepEqual(restructureMissing(ALL_OK), {});
});

test("each step validates only its own checks", () => {
  const missing = restructureMissing(NOTHING_OK);
  const byStep = Object.fromEntries(
    RESTRUCTURE_STEPS.map((s) => [s.id, Object.values(stepErrorsOf(missing, s))]),
  );
  assert.deepEqual(byStep.source, ["Member", "Source loan"]);
  assert.deepEqual(byStep.terms, [
    "Loan product",
    "Loan amount",
    "Term",
    "Payment frequency",
    "Interest rate",
    "Restructure date",
  ]);
  assert.deepEqual(byStep.collaterals, []);
  assert.deepEqual(byStep.deductions, []);
  assert.deepEqual(byStep.remarks, ["Remarks"]);
});

test("server 422 keys open the step that holds the field", () => {
  const stepOf = (key: string) => RESTRUCTURE_STEPS[stepIndexForField(key, RESTRUCTURE_STEPS)]?.id;
  // The API's own gate on the source loan answers on `status`.
  assert.equal(stepOf("status"), "source");
  assert.equal(stepOf("co_maker_ids.0"), "source");
  assert.equal(stepOf("principal_amount"), "terms");
  assert.equal(stepOf("start_date"), "terms");
  assert.equal(stepOf("deductions.1.amount"), "deductions");
  assert.equal(stepOf("remarks"), "remarks");
  assert.equal(stepOf("policy_exception_details"), "remarks");
  assert.equal(stepIndexForField("message", RESTRUCTURE_STEPS), -1);
});

test("the first step holding a server error opens", () => {
  const errors = { remarks: ["Required."], interest_rate: ["Out of range."] };
  assert.equal(RESTRUCTURE_STEPS[firstStepWithError(errors, RESTRUCTURE_STEPS)].id, "terms");
});

test("missing remarks belong to the remarks step alone", () => {
  assert.deepEqual(restructureMissing({ ...ALL_OK, remarksMissing: true }), { remarks: "Remarks" });
});
