import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ALL_BRANCHES, branchFilterOptions, branchIdParam } from "./branch-filter";

const branches = [
  { id: 1, name: "Main", code: "MN" },
  { id: 2, name: "North", code: "NO" },
  { id: 3, name: "South", code: "SO" },
];

describe("branchFilterOptions", () => {
  test("a caller without view_all sees only their branches, under All my branches", () => {
    const options = branchFilterOptions(branches, { branches: [{ id: 2, name: "North", code: "NO" }] }, false);
    assert.equal(options.allLabel, "All my branches");
    assert.deepEqual(options.branches, [{ id: 2, name: "North", code: "NO" }]);
    assert.deepEqual(options.items, [
      { value: ALL_BRANCHES, label: "All my branches" },
      { value: "2", label: "North" },
    ]);
  });

  test("a caller with view_all sees every branch, under All branches", () => {
    const options = branchFilterOptions(branches, { branches: [{ id: 2, name: "North", code: "NO" }] }, true);
    assert.equal(options.allLabel, "All branches");
    assert.deepEqual(options.items.map((i) => i.label), ["All branches", "Main", "North", "South"]);
  });

  test("a caller with no branch and no view_all is offered no branch", () => {
    const options = branchFilterOptions(branches, { branches: [] }, false);
    assert.deepEqual(options.branches, []);
    assert.deepEqual(options.items, [{ value: ALL_BRANCHES, label: "All my branches" }]);
  });
});

describe("branchIdParam", () => {
  test("the all option and anything unreadable send no branch_id", () => {
    assert.equal(branchIdParam(ALL_BRANCHES), undefined);
    assert.equal(branchIdParam(""), undefined);
    assert.equal(branchIdParam("0"), undefined);
    assert.equal(branchIdParam("abc"), undefined);
    assert.equal(branchIdParam("1.5"), undefined);
  });

  test("a branch option sends its id", () => {
    assert.equal(branchIdParam("12"), 12);
  });
});
