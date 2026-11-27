import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { roleDisplayName, roleLabelForKey, roleLabelFromServer } from "./role-display-name";

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

test("a role the server labels by its key title-cased reads by the screen's own name", () => {
  // The server falls back to Str::headline("bod1"), "Bod1", when no display
  // name is saved; every other screen reads the catalog's "BOD1".
  assert.equal(roleLabelFromServer("bod1", "Bod1"), "BOD1");
  assert.equal(roleLabelFromServer("bod7", "Bod7"), "BOD7");
  assert.equal(roleLabelFromServer("loan_processor", "Loan Processor"), roleDisplayName({ name: "loan_processor", display_name: null }));
});

test("a saved display name the server sends is kept", () => {
  assert.equal(roleLabelFromServer("bod1", "BOD Chairwoman"), "BOD Chairwoman");
  assert.equal(roleLabelFromServer("manager", "  Branch Manager "), "Branch Manager");
});

test("no server label, or no key, still reads in words", () => {
  assert.equal(roleLabelFromServer("bod2", null), "BOD2");
  assert.equal(roleLabelFromServer("bod2", ""), "BOD2");
  assert.equal(roleLabelFromServer("", "Bod2"), "Bod2");
  assert.equal(roleLabelFromServer(null, null), "");
});
