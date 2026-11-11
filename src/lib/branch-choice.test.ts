import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { NO_BRANCH, branchChoiceItems, parseBranchChoice, pickableBranches } from "./branch-choice";

const main = { id: 1, name: "Main" };
const north = { id: 2, name: "North" };
const south = { id: 3, name: "South" };

describe("pickableBranches", () => {
  test("a caller without view_all picks only their own branches, whatever the list holds", () => {
    assert.deepEqual(pickableBranches({ viewAll: false, own: [north], listed: [main, north, south] }), [north]);
  });

  test("view_all picks every listed branch, their own kept when the list lacks it", () => {
    assert.deepEqual(pickableBranches({ viewAll: true, own: [south], listed: [main, north] }), [main, north, south]);
    assert.deepEqual(pickableBranches({ viewAll: true, own: [north], listed: [main, north] }), [main, north]);
  });
});

describe("branchChoiceItems", () => {
  test("the branches by name, with the no-branch option first when one is named", () => {
    assert.deepEqual(branchChoiceItems([main, north]), [
      { value: "1", label: "Main" },
      { value: "2", label: "North" },
    ]);
    assert.deepEqual(branchChoiceItems([main], "None (head office)"), [
      { value: NO_BRANCH, label: "None (head office)" },
      { value: "1", label: "Main" },
    ]);
  });
});

describe("parseBranchChoice", () => {
  test("nothing picked, no branch, or a branch id", () => {
    assert.deepEqual(parseBranchChoice(null), { picked: false });
    assert.deepEqual(parseBranchChoice(""), { picked: false });
    assert.deepEqual(parseBranchChoice("abc"), { picked: false });
    assert.deepEqual(parseBranchChoice("0"), { picked: false });
    assert.deepEqual(parseBranchChoice(NO_BRANCH), { picked: true, branchId: null });
    assert.deepEqual(parseBranchChoice("7"), { picked: true, branchId: 7 });
  });
});
