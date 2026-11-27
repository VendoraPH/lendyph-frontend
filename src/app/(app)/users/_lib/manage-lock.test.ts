import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  BRANCH_LOCK_REASON,
  PERMISSION_LOCK_REASON,
  SUPER_ADMIN_LOCK_REASON,
  userManageLock,
} from "./manage-lock";

const none = { superAdminLocked: false, branchLocked: false };

describe("userManageLock", () => {
  test("the server's can_manage: false locks the row with the permissions reason", () => {
    assert.deepEqual(userManageLock({ can_manage: false }, none), {
      locked: true,
      reason: "This user holds permissions you don't have.",
    });
    assert.equal(PERMISSION_LOCK_REASON, "This user holds permissions you don't have.");
  });

  test("can_manage: false keeps the more specific reason the client can name", () => {
    assert.deepEqual(
      userManageLock({ can_manage: false }, { superAdminLocked: true, branchLocked: true }),
      { locked: true, reason: SUPER_ADMIN_LOCK_REASON },
    );
    assert.deepEqual(
      userManageLock({ can_manage: false }, { superAdminLocked: false, branchLocked: true }),
      { locked: true, reason: BRANCH_LOCK_REASON },
    );
  });

  test("can_manage: true never lifts a client lock", () => {
    assert.deepEqual(
      userManageLock({ can_manage: true }, { superAdminLocked: true, branchLocked: true }),
      { locked: true, reason: SUPER_ADMIN_LOCK_REASON },
    );
    assert.deepEqual(
      userManageLock({ can_manage: true }, { superAdminLocked: false, branchLocked: true }),
      { locked: true, reason: BRANCH_LOCK_REASON },
    );
  });

  test("can_manage: true with no client lock leaves the row open", () => {
    assert.deepEqual(userManageLock({ can_manage: true }, none), { locked: false, reason: null });
  });

  test("without can_manage the client locks still apply", () => {
    assert.deepEqual(userManageLock({}, none), { locked: false, reason: null });
    assert.deepEqual(userManageLock({}, { superAdminLocked: true, branchLocked: false }), {
      locked: true,
      reason: SUPER_ADMIN_LOCK_REASON,
    });
    assert.deepEqual(userManageLock({}, { superAdminLocked: false, branchLocked: true }), {
      locked: true,
      reason: BRANCH_LOCK_REASON,
    });
    assert.deepEqual(userManageLock({}, { superAdminLocked: true, branchLocked: true }), {
      locked: true,
      reason: SUPER_ADMIN_LOCK_REASON,
    });
  });

  test("a value that isn't a boolean counts as missing", () => {
    const odd = { can_manage: null } as unknown as { can_manage?: boolean };
    assert.deepEqual(userManageLock(odd, none), { locked: false, reason: null });
    assert.deepEqual(userManageLock(odd, { superAdminLocked: false, branchLocked: true }), {
      locked: true,
      reason: BRANCH_LOCK_REASON,
    });
  });
});
