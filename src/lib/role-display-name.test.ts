import { test } from "node:test";
import assert from "node:assert/strict";
import { roleDisplayName } from "./role-display-name";

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
