import { test } from "node:test";
import assert from "node:assert/strict";
import { firstStepWithError } from "@/lib/form-stepper";
import { missingFields, type RecordDraft, type RecordField } from "./record-form";
import { groupCoverage, recordStepErrors, recordSteps, serverFieldErrors, type RecordStepGroup } from "./record-steps";

const FIELDS: RecordField[] = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "status", label: "Status", type: "select", required: true },
  { key: "held_on", label: "Held on", type: "date" },
  { key: "agreed", label: "Agreed", type: "checkbox", required: true },
  { key: "remarks", label: "Remarks", type: "textarea" },
];

const GROUPS: RecordStepGroup[] = [
  { id: "one", title: "One", fields: ["name", "status"] },
  { id: "two", title: "Two", fields: ["held_on", "agreed"] },
  { id: "three", title: "Three", fields: ["remarks", "file"] },
];

test("steps keep only the fields the form shows, and the file only when it's offered", () => {
  assert.deepEqual(recordSteps(GROUPS, FIELDS, "file"), [
    { id: "one", title: "One", fields: ["name", "status"] },
    { id: "two", title: "Two", fields: ["held_on", "agreed"] },
    { id: "three", title: "Three", fields: ["remarks", "file"] },
  ]);
  assert.deepEqual(recordSteps(GROUPS, FIELDS, null)[2].fields, ["remarks"]);
});

test("a step whose fields are all missing from the form is left out", () => {
  const steps = recordSteps(GROUPS, FIELDS.filter((f) => f.key !== "remarks"), null);
  assert.deepEqual(steps.map((s) => s.id), ["one", "two"]);
  assert.deepEqual(recordSteps(GROUPS, FIELDS, "file").map((s) => s.id), ["one", "two", "three"]);
});

test("a field no group names still shows, on the last step, so nothing is lost", () => {
  const extra: RecordField = { key: "extra", label: "Extra", type: "text" };
  const steps = recordSteps(GROUPS, [...FIELDS, extra], null);
  assert.deepEqual(steps.at(-1)?.fields, ["remarks", "extra"]);
});

test("coverage finds missing, repeated and unknown keys", () => {
  assert.deepEqual(groupCoverage(GROUPS, ["name", "status", "held_on", "agreed", "remarks", "file"]), {
    missing: [],
    repeated: [],
    unknown: [],
    inOrder: true,
  });
  const bad: RecordStepGroup[] = [
    { id: "a", title: "A", fields: ["status", "name", "ghost"] },
    { id: "b", title: "B", fields: ["status"] },
  ];
  assert.deepEqual(groupCoverage(bad, ["name", "status", "remarks"]), {
    missing: ["remarks"],
    repeated: ["status"],
    unknown: ["ghost"],
    inOrder: false,
  });
});

test("each step checks only its own required fields, by label, as the form's check does", () => {
  const steps = recordSteps(GROUPS, FIELDS, "file");
  const blank: RecordDraft = { name: " ", status: "", held_on: "", agreed: "", remarks: "" };
  assert.deepEqual(recordStepErrors(steps[0], FIELDS, blank), { name: "Name", status: "Status" });
  // A checkbox is never "missing", as in missingFields.
  assert.deepEqual(recordStepErrors(steps[1], FIELDS, blank), {});
  assert.deepEqual(recordStepErrors(steps[2], FIELDS, blank), {});
  assert.deepEqual(recordStepErrors(steps[2], FIELDS, blank, { key: "file", label: "Certificate" }), {
    file: "Certificate",
  });
  // The steps together ask for exactly what the one-page form asked for.
  const all = steps.flatMap((s) => Object.values(recordStepErrors(s, FIELDS, blank)));
  assert.deepEqual(all, missingFields(FIELDS, blank));
});

test("a missing file is reported only on the step that holds it", () => {
  const steps = recordSteps(GROUPS, FIELDS, "file");
  const filled: RecordDraft = { name: "A", status: "x" };
  assert.deepEqual(recordStepErrors(steps[0], FIELDS, filled, { key: "file", label: "File" }), {});
});

test("a server 422's field errors are read; anything else is not", () => {
  const errors = { "remarks.0": ["Too long."], name: ["Taken."] };
  assert.deepEqual(serverFieldErrors({ response: { status: 422, data: { errors } } }), errors);
  assert.equal(serverFieldErrors({ response: { status: 500, data: { errors } } }), null);
  assert.equal(serverFieldErrors({ response: { status: 422, data: {} } }), null);
  assert.equal(serverFieldErrors(new Error("offline")), null);
  assert.equal(serverFieldErrors(null), null);
});

test("422 keys, dotted ones too, open the step that holds them", () => {
  const steps = recordSteps(GROUPS, FIELDS, "file");
  assert.equal(firstStepWithError({ "remarks.0": ["Too long."] }, steps), 2);
  assert.equal(firstStepWithError({ file: ["Too big."], held_on: ["Bad date."] }, steps), 1);
  assert.equal(firstStepWithError({ year: ["Closed."] }, steps), -1);
});
