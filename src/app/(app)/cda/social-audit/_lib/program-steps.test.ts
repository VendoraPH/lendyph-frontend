import { test } from "node:test";
import assert from "node:assert/strict";
import { firstStepWithError } from "@/lib/form-stepper";
import { groupCoverage, recordSteps } from "../../_lib/record-steps";
import { PROGRAM_FIELDS, PROGRAM_OFFICER_FIELD, PROGRAM_STEPS, programFields } from "./program-steps";

const OFFICER = { ...PROGRAM_OFFICER_FIELD, options: [{ value: "3", label: "Ana Cruz" }] };

test("the program form keeps its 15 fields, plus the responsible officer once officers load", () => {
  assert.equal(programFields(null).length, 15);
  const keys = programFields(OFFICER).map((f) => f.key);
  assert.equal(keys.length, 16);
  // The officer sits just before Remarks, as before.
  assert.deepEqual(keys.slice(-2), ["responsible_officer_id", "remarks"]);
  assert.deepEqual(programFields(null), PROGRAM_FIELDS);
});

test("every program field belongs to exactly one step, in the form's order", () => {
  assert.deepEqual(groupCoverage(PROGRAM_STEPS, programFields(OFFICER).map((f) => f.key)), {
    missing: [],
    repeated: [],
    unknown: [],
    inOrder: true,
  });
});

test("the program form has three steps, the officer only once the officers load", () => {
  const withOfficer = recordSteps(PROGRAM_STEPS, programFields(OFFICER), null);
  assert.deepEqual(withOfficer.map((s) => s.title), ["Program", "Funding and objective", "Description and remarks"]);
  assert.ok(withOfficer[2].fields?.includes("responsible_officer_id"));
  const without = recordSteps(PROGRAM_STEPS, programFields(null), null);
  assert.equal(without.length, 3);
  assert.equal(without[2].fields?.includes("responsible_officer_id"), false);
});

test("program 422 keys open their step", () => {
  const steps = recordSteps(PROGRAM_STEPS, programFields(OFFICER), null);
  assert.equal(firstStepWithError({ name: ["Taken."] }, steps), 0);
  assert.equal(firstStepWithError({ actual_beneficiaries: ["Whole number."] }, steps), 0);
  assert.equal(firstStepWithError({ cdf_amount: ["More than the actual expense."] }, steps), 1);
  assert.equal(firstStepWithError({ "responsible_officer_id.0": ["Not serving."] }, steps), 2);
  assert.equal(firstStepWithError({ remarks: ["Too long."], budget: ["Two decimals."] }, steps), 1);
});
