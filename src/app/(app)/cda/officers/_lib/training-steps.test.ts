import { test } from "node:test";
import assert from "node:assert/strict";
import { firstStepWithError } from "@/lib/form-stepper";
import type { CdaOfficer } from "@/types/cda";
import { groupCoverage, recordStepErrors, recordSteps } from "../../_lib/record-steps";
import { TRAINING_FILE_KEY, TRAINING_STEPS, trainingFields } from "./training-steps";

const OFFICERS = [{ id: 7, name: "Ana Cruz", position: "chairperson", member: null }] as unknown as CdaOfficer[];

test("the training form keeps its 14 fields, the officers as the pick", () => {
  const fields = trainingFields(OFFICERS);
  assert.equal(fields.length, 14);
  assert.equal(fields[0].key, "officer_id");
  assert.equal(fields[0].options?.[0].value, "7");
  assert.match(fields[0].options?.[0].label ?? "", /^Ana Cruz \(/);
});

test("every training field and the certificate belong to exactly one step, in the form's order", () => {
  const keys = [...trainingFields(OFFICERS).map((f) => f.key), TRAINING_FILE_KEY];
  assert.deepEqual(groupCoverage(TRAINING_STEPS, keys), { missing: [], repeated: [], unknown: [], inOrder: true });
});

test("the training form has two steps; the certificate shows on the second", () => {
  const steps = recordSteps(TRAINING_STEPS, trainingFields(OFFICERS), TRAINING_FILE_KEY);
  assert.deepEqual(steps.map((s) => s.title), ["Training", "Completion and certificate"]);
  assert.ok(steps[1].fields?.includes("certificate"));
  // Without a certificate slot the second step still holds its fields.
  const noFile = recordSteps(TRAINING_STEPS, trainingFields(OFFICERS), null);
  assert.equal(noFile.length, 2);
  assert.equal(noFile[1].fields?.includes("certificate"), false);
});

test("the officer, the title and the status are checked on their own steps", () => {
  const fields = trainingFields(OFFICERS);
  const steps = recordSteps(TRAINING_STEPS, fields, TRAINING_FILE_KEY);
  assert.deepEqual(recordStepErrors(steps[0], fields, {}), { officer_id: "Officer", title: "Training" });
  assert.deepEqual(recordStepErrors(steps[1], fields, {}), { status: "Status" });
});

test("training 422 keys open their step", () => {
  const steps = recordSteps(TRAINING_STEPS, trainingFields(OFFICERS), TRAINING_FILE_KEY);
  assert.equal(firstStepWithError({ officer_id: ["Pick an officer."] }, steps), 0);
  assert.equal(firstStepWithError({ provider_accreditation_no: ["Too long."] }, steps), 0);
  assert.equal(firstStepWithError({ hours: ["Two decimals."] }, steps), 1);
  assert.equal(firstStepWithError({ "certificate.0": ["Too big."] }, steps), 1);
});
