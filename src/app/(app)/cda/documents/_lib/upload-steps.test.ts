import { test } from "node:test";
import assert from "node:assert/strict";
import { firstStepWithError } from "@/lib/form-stepper";
import { groupCoverage, recordStepErrors, recordSteps } from "../../_lib/record-steps";
import { uploadFields } from "./document-form";
import { UPLOAD_FILE_KEY, UPLOAD_STEPS } from "./upload-steps";

const FIELDS = uploadFields([{ value: "minutes", label: "Minutes" }], [{ value: "4", label: "CAPR" }]);

test("every upload field and the file belong to exactly one step, in the form's order", () => {
  const keys = [...FIELDS.map((f) => f.key), UPLOAD_FILE_KEY];
  assert.deepEqual(groupCoverage(UPLOAD_STEPS, keys), { missing: [], repeated: [], unknown: [], inOrder: true });
});

test("the upload has two steps; the file is asked for on the second", () => {
  const steps = recordSteps(UPLOAD_STEPS, FIELDS, UPLOAD_FILE_KEY);
  assert.deepEqual(steps.map((s) => s.title), ["Document", "Details and file"]);
  assert.deepEqual(recordStepErrors(steps[0], FIELDS, {}), { title: "Title", category: "Category" });
  assert.deepEqual(recordStepErrors(steps[1], FIELDS, {}, { key: UPLOAD_FILE_KEY, label: "File" }), { file: "File" });
});

test("upload 422 keys open their step", () => {
  const steps = recordSteps(UPLOAD_STEPS, FIELDS, UPLOAD_FILE_KEY);
  assert.equal(firstStepWithError({ category: ["Not allowed."] }, steps), 0);
  assert.equal(firstStepWithError({ report_id: ["Restricted."] }, steps), 0);
  assert.equal(firstStepWithError({ "file.0": ["Too big."] }, steps), 1);
  assert.equal(firstStepWithError({ notes: ["Too long."] }, steps), 1);
  // Attach's subject keys belong to no field: the open step stays.
  assert.equal(firstStepWithError({ subject_id: ["Gone."] }, steps), -1);
});
