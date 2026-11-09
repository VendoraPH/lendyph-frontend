import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Permission } from "@/types";
import { setModulePermissions } from "./role-item";
import {
  GRANT_LOCK_REASON,
  SUPER_ADMIN_EDIT_REASON,
  canGrant,
  editLockReason,
  grantLockReason,
  moduleToggleTargets,
} from "./role-grant";

const admin = { roles: ["admin"], permissions: ["loans:view", "loans:create", "expenses:view"] };
const superAdmin = { roles: ["super_admin"], permissions: [] };

test("a caller who isn't super_admin may grant only the permissions they hold", () => {
  assert.equal(canGrant(admin, "loans:view"), true);
  assert.equal(canGrant(admin, "loans:approve"), false);
  assert.equal(canGrant(superAdmin, "loans:approve"), true);
});

test("an unticked box for a permission the caller doesn't hold is locked, with the reason", () => {
  assert.equal(grantLockReason(admin, "loans:approve", false), GRANT_LOCK_REASON);
  assert.equal(GRANT_LOCK_REASON, "You can only grant permissions you hold");
  // Held, or already on the role (removing is allowed), or a super_admin caller.
  assert.equal(grantLockReason(admin, "loans:view", false), null);
  assert.equal(grantLockReason(admin, "loans:approve", true), null);
  assert.equal(grantLockReason(superAdmin, "loans:approve", false), null);
});

test("toggle-all adds only what the caller holds, and removes everything", () => {
  const can = (p: Permission) => canGrant(admin, p);
  const on = setModulePermissions(new Set<Permission>(), "loans", true, can);
  assert.deepEqual([...on].sort(), ["loans:create", "loans:view"]);
  const held = new Set<Permission>(["loans:approve", "loans:view"]);
  assert.deepEqual([...setModulePermissions(held, "loans", false, can)], []);
  // A super_admin's toggle-all still covers the whole module but write_off.
  const all = setModulePermissions(new Set<Permission>(), "loans", true, (p) => canGrant(superAdmin, p));
  assert.ok(all.has("loans:approve") && !all.has("loans:write_off"));
});

test("the toggle-all targets are the module's actions the caller can grant or the role already has", () => {
  assert.deepEqual(moduleToggleTargets("loans", new Set<Permission>(["loans:approve"]), admin), ["view", "create", "approve"]);
  assert.deepEqual(moduleToggleTargets("dashboard", new Set<Permission>(), admin), []);
});

test("only a super_admin may edit the super_admin role", () => {
  assert.equal(editLockReason("super_admin", admin), SUPER_ADMIN_EDIT_REASON);
  assert.equal(editLockReason("super_admin", superAdmin), null);
  assert.equal(editLockReason("cashier", admin), null);
});

test("the role editor locks boxes, toggle-all and the super_admin Edit by the caller", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/settings/user-roles/page.tsx"), "utf8");
  assert.match(page, /grantLockReason\(caller, perm, granted\)/);
  assert.match(page, /moduleToggleTargets\(mod, permissions, caller\)/);
  assert.match(page, /setModulePermissions\(prev, mod, enable, \(p\) => canGrant\(caller, p\)\)/);
  assert.match(page, /editLockReason\(r\.key, caller\)/);
  assert.match(page, /editLockReason\(role\.key, caller\)/);
});
