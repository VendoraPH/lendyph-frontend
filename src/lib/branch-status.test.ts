import test from "node:test";
import assert from "node:assert/strict";

import {
  BRANCH_STATUS_COLORS,
  BRANCH_STATUS_LABELS,
  branchStatusAction,
  branchStatusOf,
  mayChangeBranchStatus,
} from "./branch-status";
import { LOAN_STATUS_COLORS } from "@/constants/loan-status";
import type { Permission } from "@/types";

const holds =
  (...held: Permission[]) =>
  (permission: Permission) =>
    held.includes(permission);

test("the status comes from the server's status, else from is_active (a backend before MB-BE1)", () => {
  assert.equal(branchStatusOf({ status: "closed", is_active: false }), "closed");
  assert.equal(branchStatusOf({ status: "suspended", is_active: false }), "suspended");
  assert.equal(branchStatusOf({ is_active: true }), "active");
  // MB-BE1 turns every inactive branch into a suspended one.
  assert.equal(branchStatusOf({ is_active: false }), "suspended");
});

test("statuses read Active, Suspended or Closed, never Inactive", () => {
  assert.deepEqual(BRANCH_STATUS_LABELS, { active: "Active", suspended: "Suspended", closed: "Closed" });
});

test("statuses use the app's status colours", () => {
  assert.equal(BRANCH_STATUS_COLORS.active, LOAN_STATUS_COLORS.released);
  assert.equal(BRANCH_STATUS_COLORS.suspended, LOAN_STATUS_COLORS.for_review);
  assert.equal(BRANCH_STATUS_COLORS.closed, LOAN_STATUS_COLORS.closed);
});

test("only branches:manage plus branches:view_all may change a branch's status", () => {
  assert.equal(mayChangeBranchStatus(holds("branches:manage", "branches:view_all")), true);
  assert.equal(mayChangeBranchStatus(holds("branches:manage")), false);
  assert.equal(mayChangeBranchStatus(holds("branches:view_all", "settings:update")), false);
  assert.equal(mayChangeBranchStatus(holds("settings:update")), false);
});

test("an active branch offers Suspend; a suspended one offers Reactivate", () => {
  assert.deepEqual(branchStatusAction({ status: "active", is_active: true }), {
    target: "suspended",
    label: "Suspend",
    disabledReason: null,
  });
  assert.deepEqual(branchStatusAction({ status: "suspended", is_active: false }), {
    target: "active",
    label: "Reactivate",
    disabledReason: null,
  });
});

test("a closed branch offers no status action: it stays closed", () => {
  assert.equal(branchStatusAction({ status: "closed", is_active: false }), null);
});

test("the main office can't be suspended, and says why", () => {
  const action = branchStatusAction({ status: "active", is_active: true, is_main_office: true });
  assert.equal(action?.target, "suspended");
  assert.equal(action?.disabledReason, "The main office stays active. Make another branch the main office first.");
});

test("a branch from a backend before MB-BE1 still gets its action from is_active", () => {
  assert.equal(branchStatusAction({ is_active: true })?.label, "Suspend");
  assert.equal(branchStatusAction({ is_active: false })?.label, "Reactivate");
});
