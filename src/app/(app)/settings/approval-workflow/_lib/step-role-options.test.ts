import { test } from "node:test";
import assert from "node:assert/strict";
import type { ApiRole } from "@/services/role.service";
import { stepRoleOptions } from "./step-role-options";

const role = (name: string, extra: Partial<ApiRole> = {}): ApiRole => ({
  id: name.length,
  name,
  permissions: [],
  ...extra,
});

const ROLES: ApiRole[] = [
  role("manager", { display_name: "Branch Manager", is_active: true }),
  role("loan_officer"),
  role("bod3", { display_name: "Board Member 3", is_active: false }),
];

test("lists the active roles by their display names", () => {
  const options = stepRoleOptions(ROLES, "manager");
  assert.deepEqual(
    options.map((o) => [o.value, o.label, o.disabled]),
    [
      ["manager", "Branch Manager", false],
      ["loan_officer", "Loan Officer", false],
    ],
  );
});

test("a step on a deactivated role reads 'Name (inactive)' and can't be picked again", () => {
  const options = stepRoleOptions(ROLES, "bod3");
  const current = options.find((o) => o.value === "bod3");
  assert.deepEqual(current, { value: "bod3", label: "Board Member 3 (inactive)", disabled: true });
  assert.equal(options.filter((o) => !o.disabled).length, 2);
});

test("a role missing from the list never shows its key", () => {
  const options = stepRoleOptions([], "bod3");
  assert.equal(options.length, 1);
  assert.notEqual(options[0].label, "bod3");
  assert.equal(options[0].disabled, true);
});

test("no current role, or an active one, adds nothing", () => {
  assert.equal(stepRoleOptions(ROLES, "").length, 2);
  assert.equal(stepRoleOptions(ROLES, null).length, 2);
  assert.equal(stepRoleOptions(ROLES, "loan_officer").length, 2);
});
