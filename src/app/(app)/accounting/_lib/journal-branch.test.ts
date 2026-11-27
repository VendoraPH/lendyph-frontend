import { test } from "node:test";
import assert from "node:assert/strict";
import { NO_BRANCH_VALUE, journalBranchField, journalBranchId } from "./journal-branch";

const BRANCHES = [
  { id: 1, name: "Main", code: "MN" },
  { id: 2, name: "North", code: "NO" },
  { id: 3, name: "South", code: "SO" },
];

test("with view_all, every branch is offered after No branch, and a new entry starts with no branch", () => {
  const field = journalBranchField(BRANCHES, { branches: [] }, true, null);
  assert.deepEqual(field.items, [
    { value: NO_BRANCH_VALUE, label: "No branch" },
    { value: "1", label: "Main" },
    { value: "2", label: "North" },
    { value: "3", label: "South" },
  ]);
  assert.equal(field.value, NO_BRANCH_VALUE);
});

test("without view_all, only the caller's branches are offered, and No branch is not", () => {
  const caller = { branches: [BRANCHES[1], BRANCHES[2]], branch: BRANCHES[2] };
  const field = journalBranchField(BRANCHES, caller, false, null);
  assert.deepEqual(field.items, [
    { value: "2", label: "North" },
    { value: "3", label: "South" },
  ]);
  assert.equal(field.value, "3", "a new entry shows the main branch the server will assign");
});

test("without view_all and no main branch among them, the first of the caller's branches is shown", () => {
  const caller = { branches: [BRANCHES[1], BRANCHES[2]], branch: BRANCHES[0] };
  assert.equal(journalBranchField(BRANCHES, caller, false, null).value, "2");
});

test("a picked branch stays picked", () => {
  const caller = { branches: [BRANCHES[1], BRANCHES[2]] };
  assert.equal(journalBranchField(BRANCHES, caller, false, 2).value, "2");
  assert.equal(journalBranchField(BRANCHES, { branches: [] }, true, 3).value, "3");
});

test("a caller with no branch and no view_all is offered nothing", () => {
  const field = journalBranchField(BRANCHES, { branches: [] }, false, null);
  assert.deepEqual(field.items, []);
  assert.equal(field.value, NO_BRANCH_VALUE);
});

test("the picked value becomes the branch_id sent, and No branch sends null", () => {
  assert.equal(journalBranchId(NO_BRANCH_VALUE), null);
  assert.equal(journalBranchId("3"), 3);
});
