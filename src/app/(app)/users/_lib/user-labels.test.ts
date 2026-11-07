import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { USERNAME_PLACEHOLDER, permissionChipLabel, userStatusLabel } from "./user-labels";

test("a permission chip reads module and action in words", () => {
  assert.equal(permissionChipLabel("borrowers:view"), "Members: View");
  assert.equal(permissionChipLabel("gcash:transact"), "GCash: Transact");
  assert.equal(permissionChipLabel("loans:write_off"), "Loans: Write Off");
  assert.equal(permissionChipLabel("chart_of_accounts:view"), "Chart Of Accounts: View");
  assert.equal(permissionChipLabel("branches:view_all"), "Branches: View All");
});

test("a permission with no action reads as its module", () => {
  assert.equal(permissionChipLabel("borrowers"), "Members");
});

// The API's `alpha_dash` rule takes letters, numbers, dashes and underscores, so
// the old "juan.dc" example was a username the server refuses.
test("the username example is one the server accepts", () => {
  assert.match(USERNAME_PLACEHOLDER, /^[A-Za-z0-9_-]+$/);
});

const page = readFileSync(resolve(process.cwd(), "src/app/(app)/users/page.tsx"), "utf8");

test("the dialogs show a role's display name, never its key", () => {
  assert.doesNotMatch(page, /\{role\.name\}/);
});

test("the dialogs use the shared username example and permission words", () => {
  assert.match(page, /placeholder=\{USERNAME_PLACEHOLDER\}/);
  assert.match(page, /permissionChipLabel\(p\)/);
});

test("Auto-Pay reads as the menu names it", () => {
  assert.equal(permissionChipLabel("auto_pay:view"), "Auto-Pay: View");
});

test("a user's status reads in words with a capital", () => {
  assert.equal(userStatusLabel("active"), "Active");
  assert.equal(userStatusLabel("inactive"), "Inactive");
});

test("the users list shows the status in words, never the stored key", () => {
  assert.doesNotMatch(page, /\{user\.status\}/);
  assert.match(page, /userStatusLabel\(user\.status\)/);
});
