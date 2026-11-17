import { test } from "node:test";
import assert from "node:assert/strict";
import { firstStepWithError } from "@/lib/form-stepper";
import { rolePayload } from "./role-item";
import { ROLE_STEPS, roleFormErrors, roleStepErrors, roleStepProblem, type RoleStepInput } from "./role-steps";

const create: RoleStepInput = {
  label: "Branch Manager",
  description: "Runs a branch",
  permissionCount: 2,
  isEdit: false,
  roleKey: null,
  existingKeys: ["admin", "cashier"],
};

function stepOf(key: string): string | undefined {
  const index = firstStepWithError({ [key]: ["x"] }, ROLE_STEPS);
  return index === -1 ? undefined : ROLE_STEPS[index].id;
}

test("the role dialog's steps are Details and Permissions", () => {
  assert.deepEqual(ROLE_STEPS.map((s) => s.title), ["Details", "Permissions"]);
});

test("every key a role save sends belongs to exactly one step, read as the form names it", () => {
  const item = { key: "", label: "Branch Manager", description: "Runs a branch", permissions: [], isSystem: false, isActive: true };
  for (const isEdit of [false, true]) {
    const payload = rolePayload({ ...item, key: "branch_manager" }, { isEdit });
    for (const key of Object.keys(payload)) {
      const formKeys = Object.keys(roleFormErrors({ [key]: ["x"] }));
      assert.equal(formKeys.length, 1, key);
      const holding = ROLE_STEPS.filter((s) => (s.fields ?? []).includes(formKeys[0]));
      assert.equal(holding.length, 1, `${key} is in ${holding.map((s) => s.id).join(", ") || "no step"}`);
    }
  }
});

test("a server 422 opens the step holding its field, dotted keys included", () => {
  assert.equal(stepOf("permissions.11"), "permissions");
  assert.equal(stepOf("description"), "details");
  const errors = roleFormErrors({ name: ["The name has already been taken."], "permissions.3": ["Invalid."] });
  assert.deepEqual(errors, { label: ["The name has already been taken."], "permissions.3": ["Invalid."] });
  assert.equal(ROLE_STEPS[firstStepWithError(errors, ROLE_STEPS)].id, "details");
  assert.deepEqual(roleFormErrors({ display_name: ["Reads like another role."] }), { label: ["Reads like another role."] });
});

test("both names land on the one Role Name field, the server's messages kept", () => {
  assert.deepEqual(roleFormErrors({ name: ["A"], display_name: ["B"] }), { label: ["A", "B"] });
});

test("a complete role passes both steps", () => {
  assert.equal(roleStepProblem("details", create), null);
  assert.equal(roleStepProblem("permissions", create), null);
});

test("Details lists the missing fields as the save did", () => {
  const problem = roleStepProblem("details", { ...create, label: " ", description: "" });
  assert.deepEqual(problem, {
    kind: "missing",
    fields: [
      { key: "label", label: "Role name" },
      { key: "description", label: "Description" },
    ],
  });
  assert.deepEqual(roleStepErrors(problem), { label: "Role name", description: "Description" });
});

test("Details refuses a name with no letter or number, and a taken name on create", () => {
  assert.deepEqual(roleStepProblem("details", { ...create, label: "---" }), {
    kind: "message",
    field: "label",
    message: "Role name must contain at least one letter or number",
  });
  assert.deepEqual(roleStepProblem("details", { ...create, label: "Cashier" }), {
    kind: "message",
    field: "label",
    message: 'A role named "Cashier" already exists',
  });
  assert.deepEqual(roleStepErrors(roleStepProblem("details", { ...create, label: "Cashier" })), {
    label: 'A role named "Cashier" already exists',
  });
});

test("an edit keeps the role's own key, so its name never clashes with itself", () => {
  const edit = { ...create, isEdit: true, roleKey: "cashier", label: "---" };
  assert.equal(roleStepProblem("details", edit), null);
  assert.equal(roleStepProblem("details", { ...edit, label: "Admin" }), null);
});

test("Permissions needs at least one", () => {
  assert.deepEqual(roleStepProblem("permissions", { ...create, permissionCount: 0 }), {
    kind: "message",
    field: "permissions",
    message: "Select at least one permission",
  });
  // Details never looks at the permissions.
  assert.equal(roleStepProblem("details", { ...create, permissionCount: 0 }), null);
});

test("no problem is no error", () => {
  assert.deepEqual(roleStepErrors(null), {});
});
