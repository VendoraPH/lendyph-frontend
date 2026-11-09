import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { roleDisplayName, roleLabelForKey } from "./role-display-name";

test("a saved display name wins, trimmed", () => {
  assert.equal(roleDisplayName({ name: "admin", display_name: "  Branch Head " }), "Branch Head");
});

test("a blank or absent display name falls back to the catalog label", () => {
  assert.equal(roleDisplayName({ name: "admin", display_name: null }), "Admin");
  assert.equal(roleDisplayName({ name: "admin", display_name: "   " }), "Admin");
  assert.equal(roleDisplayName({ name: "loan_officer" }), "Loan Officer");
});

test("a role the catalog does not know reads as its key title-cased", () => {
  assert.equal(roleDisplayName({ name: "branch_auditor" }), "Branch Auditor");
});

test("a role key is labelled by the matching role's saved display name", () => {
  const roles = [
    { name: "admin", display_name: "Branch Head" },
    { name: "cashier", display_name: null },
  ];
  assert.equal(roleLabelForKey("admin", roles), "Branch Head");
  assert.equal(roleLabelForKey("cashier", roles), "Cashier");
});

test("a role key with no list, or missing from it, falls back to the catalog or title case", () => {
  assert.equal(roleLabelForKey("admin", undefined), "Admin");
  assert.equal(roleLabelForKey("branch_auditor", []), "Branch Auditor");
});

test("no role key reads as an empty label", () => {
  assert.equal(roleLabelForKey("", [{ name: "admin", display_name: "Branch Head" }]), "");
  assert.equal(roleLabelForKey(null, undefined), "");
});

// Round 2: `/auth/me` sends the caller's own roles with their display names
// (`role_details`), readable without `users:view`, so Access Restricted can
// name a custom role for a user who can't list roles.
test("the caller's own role details name the role, by key or by name", () => {
  const custom = { name: "cs_summary_role", display_name: null };
  assert.equal(
    roleLabelForKey("cs_summary_role", undefined, [{ key: "cs_summary_role", display_name: "CS Summary" }]),
    "CS Summary",
  );
  assert.equal(
    roleLabelForKey("cs_summary_role", undefined, [{ name: "cs_summary_role", display_name: " CS Summary " }]),
    "CS Summary",
  );
  assert.equal(
    roleLabelForKey("cs_summary_role", [custom], [{ key: "cs_summary_role", display_name: "CS Summary" }]),
    "CS Summary",
  );
});

test("without role details, or without a saved name in them, the role reads as before", () => {
  assert.equal(roleLabelForKey("cs_summary_role", undefined, undefined), "Cs Summary Role");
  assert.equal(roleLabelForKey("cs_summary_role", undefined, []), "Cs Summary Role");
  assert.equal(
    roleLabelForKey("cs_summary_role", undefined, [{ key: "cs_summary_role", display_name: null }]),
    "Cs Summary Role",
  );
  assert.equal(
    roleLabelForKey("cs_summary_role", undefined, [{ key: "other_role", display_name: "Other" }]),
    "Cs Summary Role",
  );
  assert.equal(
    roleLabelForKey("cs_summary_role", [{ name: "cs_summary_role", display_name: "From Roles" }], undefined),
    "From Roles",
  );
  assert.equal(roleLabelForKey("accountant", undefined, undefined), "Accountant");
});

test("useRoleLabel passes the signed-in user's role details", () => {
  const hook = readFileSync(join(process.cwd(), "src/hooks/use-role-label.ts"), "utf8");
  assert.match(hook, /state\.user\?\.role_details/);
  assert.match(hook, /roleLabelForKey\(key, canListRoles \? roles : undefined, ownRoles\)/);
});
