import { test } from "node:test";
import assert from "node:assert/strict";
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
