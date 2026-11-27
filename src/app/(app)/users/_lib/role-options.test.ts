import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ApiRole } from "@/services/role.service";
import { isInactiveRole, roleOptionLabel, roleOptions, withoutUnchangedRole } from "./role-options";

const role = (name: string, is_active?: boolean): ApiRole => ({ id: name.length, name, permissions: [], is_active });

const ROLES = [role("cashier", true), role("night_desk", false), role("legacy")];

test("deactivated roles are not offered", () => {
  assert.deepEqual(roleOptions(ROLES).map((r) => r.name), ["cashier", "legacy"]);
});

test("a role with no is_active flag counts as active", () => {
  assert.ok(roleOptions(ROLES).some((r) => r.name === "legacy"));
  assert.equal(isInactiveRole(role("legacy")), false);
});

test("the deactivated role a user already holds stays visible on their edit form", () => {
  assert.deepEqual(roleOptions(ROLES, "night_desk").map((r) => r.name), ["cashier", "night_desk", "legacy"]);
  assert.equal(isInactiveRole(ROLES[1]), true);
});

test("a deactivated role is labelled \"Name (inactive)\"", () => {
  assert.equal(roleOptionLabel({ ...role("night_desk", false), display_name: "RA Inactive Role" }), "RA Inactive Role (inactive)");
  assert.equal(roleOptionLabel(role("night_desk", false)), "Night Desk (inactive)");
});

test("an active role, or one with no is_active flag, has no suffix", () => {
  assert.equal(roleOptionLabel({ ...role("cashier", true), display_name: "Front Cashier" }), "Front Cashier");
  assert.equal(roleOptionLabel(role("legacy")), "Legacy");
});

test("holding an active role doesn't bring back other deactivated ones", () => {
  assert.deepEqual(roleOptions(ROLES, "cashier").map((r) => r.name), ["cashier", "legacy"]);
});

test("an unchanged role is left out of the edit payload", () => {
  assert.deepEqual(withoutUnchangedRole({ first_name: "Ina", role: "night_desk" }, "night_desk"), { first_name: "Ina" });
});

test("a changed role is sent", () => {
  assert.deepEqual(withoutUnchangedRole({ first_name: "Ina", role: "cashier" }, "night_desk"), {
    first_name: "Ina",
    role: "cashier",
  });
  assert.deepEqual(withoutUnchangedRole({ role: "cashier" }), { role: "cashier" });
});

// super_admin is the platform team's role: only a super_admin is offered it.
test("super_admin is offered only to a caller who holds it", () => {
  const roles = [role("super_admin", true), role("admin", true), role("cashier", true)];
  assert.deepEqual(roleOptions(roles).map((r) => r.name), ["admin", "cashier"]);
  assert.deepEqual(roleOptions(roles, undefined, ["admin"]).map((r) => r.name), ["admin", "cashier"]);
  assert.deepEqual(roleOptions(roles, undefined, ["super_admin"]).map((r) => r.name), ["super_admin", "admin", "cashier"]);
  // The role the edited user already holds stays shown, as a deactivated one does.
  assert.deepEqual(roleOptions(roles, "super_admin", ["admin"]).map((r) => r.name), ["super_admin", "admin", "cashier"]);
});

test("both user dialogs pass the caller's roles", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/users/page.tsx"), "utf8");
  assert.match(page, /roleOptions\(roles, undefined, callerRoles\)/);
  assert.match(page, /roleOptions\(roles, user\.roles\?\.\[0\], callerRoles\)/);
});
