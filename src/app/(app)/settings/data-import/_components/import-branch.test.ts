import { test } from "node:test";
import assert from "node:assert/strict";
import { importBranchChoice } from "./import-branch";

const MINE = [{ id: 3 }, { id: 7 }];

test("an offered branch stays picked", () => {
  assert.equal(importBranchChoice(MINE, 7), 7);
});

// Phase 6 (D8): the server refuses an import into a branch that isn't the
// caller's, so a branch the picker doesn't offer is never kept or sent.
test("a branch the picker doesn't offer is dropped", () => {
  assert.equal(importBranchChoice(MINE, 99), null);
});

test("the only offered branch is picked for the reviewer, otherwise nothing is", () => {
  assert.equal(importBranchChoice([{ id: 3 }], null), 3);
  assert.equal(importBranchChoice([{ id: 3 }], 99), 3);
  assert.equal(importBranchChoice(MINE, null), null);
  assert.equal(importBranchChoice([], null), null);
  assert.equal(importBranchChoice([], 3), null);
});
