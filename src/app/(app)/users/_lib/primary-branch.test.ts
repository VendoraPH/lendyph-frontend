import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ORGANISATION_WIDE,
  OWN_PRIMARY_LOCK_REASON,
  PRIMARY_BRANCH_REQUIRED,
  ownPrimaryBranchLock,
  primaryBranchFromValue,
  primaryBranchOptions,
  primaryBranchOptionsFor,
  primaryBranchProblem,
  primaryBranchValue,
  roleSeesAllBranches,
  shownPrimaryBranch,
} from "./primary-branch";

const north = { id: 3, name: "North" };
const south = { id: 9, name: "South" };

describe("roleSeesAllBranches", () => {
  test("a role holding branches:view_all sees every branch", () => {
    assert.equal(roleSeesAllBranches({ name: "manager", permissions: ["loans:view", "branches:view_all"] }), true);
  });

  test("a role without it doesn't, and neither does no role at all", () => {
    assert.equal(roleSeesAllBranches({ name: "loan_officer", permissions: ["loans:view"] }), false);
    assert.equal(roleSeesAllBranches(undefined), false);
  });

  test("super_admin always does, whatever its list says", () => {
    assert.equal(roleSeesAllBranches({ name: "super_admin", permissions: [] }), true);
  });

  test("a deactivated role grants nothing, except admin and super_admin, which always count", () => {
    assert.equal(
      roleSeesAllBranches({ name: "manager", permissions: ["branches:view_all"], is_active: false }),
      false,
    );
    assert.equal(
      roleSeesAllBranches({ name: "admin", permissions: ["branches:view_all"], is_active: false }),
      true,
    );
  });
});

describe("primaryBranchOptions", () => {
  test("the user's selected branches by name, in the order given", () => {
    assert.deepEqual(primaryBranchOptions([north, south], false), [
      { value: "3", label: "North" },
      { value: "9", label: "South" },
    ]);
  });

  test("Organisation-wide comes last, and only for a role that sees every branch", () => {
    assert.deepEqual(primaryBranchOptions([north], true), [
      { value: "3", label: "North" },
      { value: ORGANISATION_WIDE, label: "Organisation-wide" },
    ]);
    assert.ok(!primaryBranchOptions([north], false).some((o) => o.value === ORGANISATION_WIDE));
  });
});

describe("shownPrimaryBranch", () => {
  const both = primaryBranchOptions([north, south], true);

  test("a chosen branch that is still selected stays chosen", () => {
    assert.equal(shownPrimaryBranch(9, both), 9);
  });

  test("Organisation-wide stays while it is offered", () => {
    assert.equal(shownPrimaryBranch(null, both), null);
  });

  test("a branch taken off the user falls to the only branch left", () => {
    assert.equal(shownPrimaryBranch(9, primaryBranchOptions([north], false)), 3);
  });

  test("with several branches left and none of them chosen, nothing is chosen until the admin picks", () => {
    assert.equal(shownPrimaryBranch(undefined, primaryBranchOptions([north, south], false)), undefined);
    assert.equal(shownPrimaryBranch(12, primaryBranchOptions([north, south], false)), undefined);
  });

  test("Organisation-wide is never picked for the admin, even beside a single branch", () => {
    assert.equal(shownPrimaryBranch(undefined, primaryBranchOptions([north], true)), 3);
  });

  test("Organisation-wide no longer offered (the role changed) falls back like a removed branch", () => {
    assert.equal(shownPrimaryBranch(null, primaryBranchOptions([north], false)), 3);
    assert.equal(shownPrimaryBranch(null, primaryBranchOptions([north, south], false)), undefined);
  });

  test("no branch selected yet: nothing is chosen", () => {
    assert.equal(shownPrimaryBranch(undefined, primaryBranchOptions([], true)), undefined);
    assert.equal(shownPrimaryBranch(3, primaryBranchOptions([], false)), undefined);
  });
});

describe("the select's value", () => {
  test("a branch reads as its id, Organisation-wide as its own value, and nothing chosen as no value", () => {
    assert.equal(primaryBranchValue(3), "3");
    assert.equal(primaryBranchValue(null), ORGANISATION_WIDE);
    assert.equal(primaryBranchValue(undefined), null);
  });

  test("and back again; anything else is nothing chosen", () => {
    assert.equal(primaryBranchFromValue("3"), 3);
    assert.equal(primaryBranchFromValue(ORGANISATION_WIDE), null);
    assert.equal(primaryBranchFromValue(null), undefined);
    assert.equal(primaryBranchFromValue("north"), undefined);
    assert.equal(primaryBranchFromValue("0"), undefined);
  });
});

describe("primaryBranchProblem", () => {
  test("a user with branches needs a primary branch", () => {
    assert.equal(primaryBranchProblem(undefined, 2), PRIMARY_BRANCH_REQUIRED);
    assert.equal(PRIMARY_BRANCH_REQUIRED, "Choose the user's primary branch.");
  });

  test("a chosen branch or Organisation-wide is enough", () => {
    assert.equal(primaryBranchProblem(3, 2), null);
    assert.equal(primaryBranchProblem(null, 1), null);
  });

  test("before any branch is picked the branches field says what is missing", () => {
    assert.equal(primaryBranchProblem(undefined, 0), null);
  });
});

describe("ownPrimaryBranchLock", () => {
  test("a caller who doesn't see every branch can't change their own primary branch", () => {
    assert.equal(ownPrimaryBranchLock({ isSelf: true, viewAll: false }), OWN_PRIMARY_LOCK_REASON);
    assert.equal(
      OWN_PRIMARY_LOCK_REASON,
      "You can't change your own primary branch. Another administrator has to do it for you.",
    );
  });

  test("one who sees every branch can, and anyone can change someone else's", () => {
    assert.equal(ownPrimaryBranchLock({ isSelf: true, viewAll: true }), null);
    assert.equal(ownPrimaryBranchLock({ isSelf: false, viewAll: false }), null);
  });
});

describe("primaryBranchOptionsFor", () => {
  const all = [north, { id: 5, name: "East" }, south];

  test("only the branches the form assigns, in the branch list's order", () => {
    assert.deepEqual(primaryBranchOptionsFor(all, [9, 3], { name: "loan_officer", permissions: [] }), [
      { value: "3", label: "North" },
      { value: "9", label: "South" },
    ]);
  });

  test("Organisation-wide follows the role the form assigns", () => {
    const options = primaryBranchOptionsFor(all, [5], { name: "manager", permissions: ["branches:view_all"] });
    assert.deepEqual(options.map((o) => o.value), ["5", ORGANISATION_WIDE]);
    assert.deepEqual(primaryBranchOptionsFor(all, [5], undefined).map((o) => o.value), ["5"]);
  });
});
