import { test } from "node:test";
import assert from "node:assert/strict";
import { firstStepWithError } from "@/lib/form-stepper";
import { groupCoverage, recordStepErrors, recordSteps } from "../../_lib/record-steps";
import { CASE_FIELDS, CASE_STEPS } from "./case-steps";

test("the case form keeps its 12 fields", () => {
  assert.equal(CASE_FIELDS.length, 12);
});

test("every case field belongs to exactly one step, in the form's order", () => {
  assert.deepEqual(groupCoverage(CASE_STEPS, CASE_FIELDS.map((f) => f.key)), {
    missing: [],
    repeated: [],
    unknown: [],
    inOrder: true,
  });
});

test("the case form has two steps, and their titles name no case details", () => {
  const steps = recordSteps(CASE_STEPS, CASE_FIELDS, null);
  assert.deepEqual(steps.map((s) => s.title), ["Case", "Resolution and remarks"]);
  assert.deepEqual(recordStepErrors(steps[0], CASE_FIELDS, {}), { filed_on: "Filed on", status: "Status" });
  assert.deepEqual(recordStepErrors(steps[1], CASE_FIELDS, {}), {});
});

test("case 422 keys open their step", () => {
  const steps = recordSteps(CASE_STEPS, CASE_FIELDS, null);
  assert.equal(firstStepWithError({ resolved_on: ["Needed once resolved."] }, steps), 0);
  assert.equal(firstStepWithError({ meetings_count: ["Whole number."] }, steps), 0);
  assert.equal(firstStepWithError({ resolution: ["Too long."] }, steps), 1);
  assert.equal(firstStepWithError({ "remarks.0": ["Too long."] }, steps), 1);
});
