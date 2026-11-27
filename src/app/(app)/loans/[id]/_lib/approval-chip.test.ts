import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { approvalChipLabel, type ApprovalChipState } from "./approval-chip";

const base: ApprovalChipState = {
  loading: false,
  unavailable: false,
  allApproved: false,
  currentStepIndex: -1,
  stepCount: 0,
  status: "released",
  imported: false,
};

test("an imported loan with no chain reads \"Imported\", never \"No steps found\" (round 8)", () => {
  assert.equal(approvalChipLabel({ ...base, imported: true }), "Imported");
  // Its chain read can fail too (no chain was ever seeded): still "Imported",
  // beside the "Imported from the cooperative's records" note.
  assert.equal(approvalChipLabel({ ...base, imported: true, unavailable: true }), "Imported");
});

test("only an imported loan reads \"Imported\"", () => {
  assert.equal(approvalChipLabel(base), "No steps found");
  assert.equal(approvalChipLabel({ ...base, unavailable: true }), "Unavailable");
  assert.equal(approvalChipLabel({ ...base, status: "draft" }), "Not submitted");
});

test("an imported loan that has steps reads them as any loan does", () => {
  assert.equal(approvalChipLabel({ ...base, imported: true, stepCount: 3, allApproved: true }), "Complete");
  assert.equal(approvalChipLabel({ ...base, imported: true, stepCount: 3, currentStepIndex: 1 }), "Step 2 of 3");
});

test("the other states read as before", () => {
  assert.equal(approvalChipLabel({ ...base, loading: true, imported: true }), "Loading...");
  assert.equal(approvalChipLabel({ ...base, stepCount: 2, allApproved: true }), "Complete");
  assert.equal(approvalChipLabel({ ...base, stepCount: 4, currentStepIndex: 0 }), "Step 1 of 4");
  assert.equal(approvalChipLabel({ ...base, stepCount: 4 }), "4 steps");
});

test("the loan page's approval chip reads through the rule", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");

  assert.match(page, /approvalChipLabel\(\{/);
  assert.doesNotMatch(page, /"No steps found"/);
});
