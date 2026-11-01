import { test } from "node:test";
import assert from "node:assert/strict";
import type { Permission } from "@/types";
import {
  roleItemFromApi,
  rolePayload,
  setModulePermissions,
  togglePermission,
  type RoleItem,
} from "./role-item";

// A role holding permissions the matrix shows, the retired collections:* the
// matrix hides, and grants that simply have no checkbox.
const apiRole = {
  id: 2,
  name: "admin",
  description: "Client-side administrator",
  permissions: [
    "fees:view",
    "loans:view",
    "collections:view",
    "collections:mark_collected",
    "users:reset_password",
    "loans:extend",
  ],
  is_system: true,
  is_active: true,
};

const untouched = [
  "collections:view",
  "collections:mark_collected",
  "users:reset_password",
  "loans:extend",
] as Permission[];

test("loading a role keeps every permission it holds, including collections:*", () => {
  assert.deepEqual(roleItemFromApi(apiRole).permissions, apiRole.permissions);
});

// What Save sends is exactly the set the form holds, and the API replaces the
// role's permissions with it. So this is the regression: editing one module
// must not drop anything the form never showed.
test("saving a role keeps permissions the form did not change", () => {
  let form = new Set(roleItemFromApi(apiRole).permissions);
  form = togglePermission(form, "fees:create" as Permission);
  form = setModulePermissions(form, "loans", true);
  form = setModulePermissions(form, "loans", false);

  const saved = Array.from(form);
  for (const p of untouched) assert.ok(saved.includes(p), `${p} was dropped`);
  assert.ok(saved.includes("fees:create" as Permission));
  assert.ok(!saved.includes("loans:view" as Permission));
});

test("an unchanged save sends the role's permissions back as they came", () => {
  const form = new Set(roleItemFromApi(apiRole).permissions);
  assert.deepEqual([...form].sort(), [...apiRole.permissions].sort());
});

test("unticking a module only revokes the actions the matrix offers for it", () => {
  const form = setModulePermissions(new Set(apiRole.permissions as Permission[]), "loans", false);
  assert.ok(form.has("loans:extend" as Permission), "loans:extend has no checkbox and must survive");
  assert.ok(!form.has("loans:view" as Permission));
});

test("togglePermission flips only the one permission", () => {
  const before = new Set(apiRole.permissions as Permission[]);
  const after = togglePermission(before, "fees:view" as Permission);
  assert.ok(!after.has("fees:view" as Permission));
  assert.equal(after.size, before.size - 1);
  assert.ok(before.has("fees:view" as Permission), "the input set is not mutated");
});

// ── role names ─────────────────────────────────────────────────────────────
//
// The key (`name`) is the identifier permission checks use and never changes on
// edit. What an admin renames is the role's `display_name`. Until this, Save
// sent only the pinned key, so a rename saved nothing.

test("a role's label is its saved display name when it has one", () => {
  assert.equal(roleItemFromApi({ ...apiRole, display_name: "Branch Head" }).label, "Branch Head");
});

test("a role without a display name keeps the catalog label, then the title-cased key", () => {
  assert.equal(roleItemFromApi({ ...apiRole, display_name: null }).label, "Admin");
  assert.equal(roleItemFromApi({ ...apiRole, display_name: "  " }).label, "Admin");
  assert.equal(
    roleItemFromApi({ ...apiRole, name: "branch_auditor", display_name: null }).label,
    "Branch Auditor",
  );
});

const editedAdmin: RoleItem = {
  id: 2,
  key: "admin",
  label: "Branch Head",
  description: "Client-side administrator",
  permissions: ["fees:view"] as Permission[],
  isSystem: true,
  isActive: true,
};

test("saving an edited role sends the new label as display_name", () => {
  assert.equal(rolePayload(editedAdmin, { isEdit: true }).display_name, "Branch Head");
});

test("saving an edited role never sends a name, so the key cannot change", () => {
  assert.ok(!("name" in rolePayload(editedAdmin, { isEdit: true })));
});

test("an edit still sends the description and the full permission set", () => {
  const payload = rolePayload(editedAdmin, { isEdit: true });
  assert.equal(payload.description, "Client-side administrator");
  assert.deepEqual(payload.permissions, ["fees:view"]);
});

test("creating a role sends the slugged key as name and the label as display_name", () => {
  const created: RoleItem = {
    key: "branch_auditor",
    label: "Branch Auditor",
    description: "Reviews branch books",
    permissions: ["fees:view"] as Permission[],
    isSystem: false,
    isActive: true,
  };
  assert.deepEqual(rolePayload(created, { isEdit: false }), {
    name: "branch_auditor",
    display_name: "Branch Auditor",
    description: "Reviews branch books",
    permissions: ["fees:view"],
  });
});
