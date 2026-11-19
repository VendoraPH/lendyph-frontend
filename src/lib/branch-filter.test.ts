import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ALL_BRANCHES, LOADING_BRANCHES, branchFilterOptions, branchIdParam, shownBranchValue } from "./branch-filter";

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

describe("shownBranchValue: a branch filter never shows a raw id or a wrong All", () => {
  const items = [
    { value: ALL_BRANCHES, label: "All branches" },
    { value: "2", label: "North" },
  ];

  test("a value the items name is shown", () => {
    assert.deepEqual(shownBranchValue("2", items, false), { value: "2", placeholder: undefined });
    assert.deepEqual(shownBranchValue(ALL_BRANCHES, items, true), { value: ALL_BRANCHES, placeholder: undefined });
  });

  test("a branch not listed yet reads Loading branches while the list loads", () => {
    assert.deepEqual(shownBranchValue("3", [items[0]], true), { value: null, placeholder: LOADING_BRANCHES });
  });

  test("a branch the loaded list doesn't offer reads Select a branch, never its id", () => {
    assert.deepEqual(shownBranchValue("3", items, false), { value: null, placeholder: "Select a branch" });
  });
});
