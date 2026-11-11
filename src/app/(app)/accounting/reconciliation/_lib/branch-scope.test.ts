import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { NO_BRANCH } from "@/lib/branch-choice";
import {
  ALL_BRANCHES_SCOPE,
  ANY_BRANCH,
  branchScopeLabel,
  reconciliationBranchChoice,
  reconciliationFilterItems,
  reconciliationFilterParams,
} from "./branch-scope";

const main = { id: 1, name: "Main" };
const north = { id: 2, name: "North" };
const south = { id: 3, name: "South" };

describe("the start form's branch", () => {
  test("a branch user with one branch has it preselected, with no All branches option", () => {
    const choice = reconciliationBranchChoice({ viewAll: false, own: [north], listed: [main, north, south] });
    assert.deepEqual(choice, { kind: "pick", items: [{ value: "2", label: "North" }], preselected: "2" });
  });

  test("a branch user with several branches must pick one of theirs", () => {
    const choice = reconciliationBranchChoice({ viewAll: false, own: [north, south], listed: [main, north, south] });
    assert.deepEqual(choice, {
      kind: "pick",
      items: [
        { value: "2", label: "North" },
        { value: "3", label: "South" },
      ],
      preselected: null,
    });
  });

  test("view_all is offered All branches and every branch, and picks on purpose", () => {
    const choice = reconciliationBranchChoice({ viewAll: true, own: [main], listed: [main, north] });
    assert.deepEqual(choice, {
      kind: "pick",
      items: [
        { value: NO_BRANCH, label: ALL_BRANCHES_SCOPE },
        { value: "1", label: "Main" },
        { value: "2", label: "North" },
      ],
      preselected: null,
    });
  });

  test("a branch user with no branch can't start one", () => {
    assert.deepEqual(reconciliationBranchChoice({ viewAll: false, own: [], listed: [] }), { kind: "unassigned" });
  });
});

describe("the list's branch filter", () => {
  test("a branch user filters by their own branches, under All my branches", () => {
    assert.deepEqual(reconciliationFilterItems(false, [north]), [
      { value: ANY_BRANCH, label: "All my branches" },
      { value: "2", label: "North" },
    ]);
  });

  test("view_all adds the All branches reconciliations as their own option", () => {
    assert.deepEqual(reconciliationFilterItems(true, [main, north]), [
      { value: ANY_BRANCH, label: "All reconciliations" },
      { value: "all", label: ALL_BRANCHES_SCOPE },
      { value: "1", label: "Main" },
      { value: "2", label: "North" },
    ]);
  });

  test("the branch_id each option sends", () => {
    assert.deepEqual(reconciliationFilterParams(ANY_BRANCH), {});
    assert.deepEqual(reconciliationFilterParams("all"), { branch_id: "all" });
    assert.deepEqual(reconciliationFilterParams("2"), { branch_id: 2 });
    assert.deepEqual(reconciliationFilterParams("junk"), {});
  });
});

describe("a reconciliation's branch in words", () => {
  test("the server's branch_name; All branches when the scope is all; nothing from an older API", () => {
    assert.equal(branchScopeLabel({ branch_id: 2, branch_name: "North" }), "North");
    assert.equal(branchScopeLabel({ branch_id: null, branch_name: "All branches" }), "All branches");
    assert.equal(branchScopeLabel({ branch_id: null }), "All branches");
    assert.equal(branchScopeLabel({}), null);
  });
});
