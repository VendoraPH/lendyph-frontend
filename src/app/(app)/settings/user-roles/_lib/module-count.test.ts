import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULE_ACTIONS } from "./permission-matrix";
import { OFFERED_MODULE_TOTAL, roleModuleCount } from "./module-count";

// Admin as staging served it before `loan_products:manage` was seeded: every
// permission, including modules the matrix does not offer (loan_adjustments,
// auto_credit, the retired collections) and actions it has no checkbox for
// (users:reset_password, loans:extend, settings:delete, expenses:pay).
const ADMIN_PERMISSIONS = [
  "dashboard:view",
  "users:view", "users:create", "users:update", "users:delete", "users:reset_password",
  "borrowers:view", "borrowers:create", "borrowers:update", "borrowers:delete", "borrowers:approve",
  "loans:view", "loans:create", "loans:update", "loans:delete", "loans:approve", "loans:reject",
  "loans:release", "loans:void", "loans:extend", "loans:restructure", "loans:write_off",
  "payments:view", "payments:create", "payments:update", "payments:void",
  "loan_adjustments:view", "loan_adjustments:create", "loan_adjustments:approve",
  "reports:view", "reports:export",
  "audit_logs:view", "audit_logs:export",
  "fees:view", "fees:create", "fees:update", "fees:delete",
  "share_capital:view", "share_capital:create", "share_capital:update",
  "auto_credit:process",
  "auto_pay:view", "auto_pay:process", "auto_pay:toggle",
  "gcash:view", "gcash:transact", "gcash:settings",
  "collections:view", "collections:mark_collected",
  "settings:view", "settings:update", "settings:delete",
  "imports:process",
  "accounting:view", "accounting:reconcile", "accounting:close", "accounting:settings",
  "chart_of_accounts:view", "chart_of_accounts:create", "chart_of_accounts:update", "chart_of_accounts:delete",
  "journals:view", "journals:create", "journals:post", "journals:reverse",
  "expenses:view", "expenses:create", "expenses:update", "expenses:pay",
  "cash_accounts:view", "cash_accounts:transfer",
  "credit_scoring:view", "credit_scoring:override", "credit_scoring:settings",
  "collaterals:view", "collaterals:create", "collaterals:update", "collaterals:delete",
];

// The roles list read "22 of 20" for Admin: it counted every module the role
// holds anything in, against the modules the matrix offers.
test("admin's module count never exceeds the modules offered", () => {
  assert.ok(
    roleModuleCount(ADMIN_PERMISSIONS) <= OFFERED_MODULE_TOTAL,
    `${roleModuleCount(ADMIN_PERMISSIONS)} of ${OFFERED_MODULE_TOTAL}`,
  );
});

// Admin is also granted `branches:view_all` (backend migration
// 2026_11_02_210000), the one permission of the Branch Access module, and the
// four reminders permissions (Phase 2).
const REMINDERS = ["reminders:view", "reminders:send", "reminders:pause", "reminders:settings"];

test("admin holding loan_products:manage, branches:view_all and reminders is in every offered module", () => {
  assert.equal(
    roleModuleCount([...ADMIN_PERMISSIONS, ...REMINDERS, "loan_products:manage", "branches:view_all"]),
    OFFERED_MODULE_TOTAL,
  );
});

test("admin without branches:view_all is one module short", () => {
  assert.equal(
    roleModuleCount([...ADMIN_PERMISSIONS, ...REMINDERS, "loan_products:manage"]),
    OFFERED_MODULE_TOTAL - 1,
  );
});

test("branches:view_all has a checkbox and counts the branch access module", () => {
  assert.equal(roleModuleCount(["branches:view_all"]), 1);
});

test("a role holding every offered permission is in every offered module", () => {
  const everyOffered = Object.entries(MODULE_ACTIONS).flatMap(([mod, actions]) =>
    actions.map((action) => `${mod}:${action}`),
  );
  assert.equal(roleModuleCount([...everyOffered, "loan_adjustments:view"]), OFFERED_MODULE_TOTAL);
});

test("modules the matrix does not offer are not counted", () => {
  assert.equal(
    roleModuleCount(["loan_adjustments:view", "auto_credit:process", "collections:view"]),
    0,
  );
});

test("reminders has checkboxes and counts as one module", () => {
  assert.equal(roleModuleCount(["reminders:view"]), 1);
  assert.equal(roleModuleCount(["reminders:view", "reminders:send", "reminders:pause", "reminders:settings"]), 1);
});

// The edit dialog shows such a module as 0 of its actions granted, so the
// list must not call it one of the role's modules either.
test("a module counts only when the role holds an action the matrix offers in it", () => {
  assert.equal(roleModuleCount(["loans:extend", "users:reset_password"]), 0);
  assert.equal(roleModuleCount(["loans:extend", "loans:view"]), 1);
});

// The matrix offers `loans:write_off` now, so holding it alone puts a role in
// the Loans module, like any other action with a checkbox.
test("loans:write_off has a checkbox and counts the loans module", () => {
  assert.ok(MODULE_ACTIONS.loans.includes("write_off"));
  assert.equal(roleModuleCount(["loans:write_off"]), 1);
});

test("several permissions in one module count it once", () => {
  assert.equal(roleModuleCount(["fees:view", "fees:create", "dashboard:view"]), 2);
});

test("a role with no permissions is in no modules", () => {
  assert.equal(roleModuleCount([]), 0);
});
