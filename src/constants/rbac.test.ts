import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLES } from "./rbac";

const REMINDERS = ["reminders:view", "reminders:send", "reminders:pause", "reminders:settings"];

// Phase 2: the four reminders permissions are seeded for admin and
// super_admin only. super_admin has no entry in this map (see `Role`).
test("admin holds all four reminders permissions", () => {
  assert.deepEqual(
    ROLES.admin.permissions.filter((p) => p.startsWith("reminders:")),
    REMINDERS,
  );
});

test("no role but admin holds a reminders permission", () => {
  for (const [role, config] of Object.entries(ROLES)) {
    if (role === "admin") continue;
    assert.deepEqual(
      config.permissions.filter((p) => p.startsWith("reminders:")),
      [],
      role,
    );
  }
});

// Copied from lendyph-backend `RoleAndPermissionSeeder::ACCOUNTANT_PERMISSIONS`
// (round C, slice C1). The roles screen seeds the Accountant's grid from
// `ROLES.accountant`, so it must match the server's list exactly.
const ACCOUNTANT_PERMISSIONS = [
  "accounting:view",
  "accounting:reconcile",
  "accounting:close",
  "accounting:settings",
  "accounting:allowance",
  "chart_of_accounts:view",
  "chart_of_accounts:create",
  "chart_of_accounts:update",
  "chart_of_accounts:delete",
  "journals:view",
  "journals:create",
  "journals:post",
  "journals:reverse",
  "expenses:view",
  "expenses:create",
  "expenses:update",
  "expenses:pay",
  "cash_accounts:view",
  "cash_accounts:transfer",
  "branches:view_all",
  "dashboard:view",
  "reports:view",
  "reports:export",
  "loans:view",
  "payments:view",
  "loan_adjustments:view",
  "share_capital:view",
  "gcash:view",
  "fees:view",
  "audit_logs:view",
];

test("the Accountant role is labelled in words and holds exactly the server's list", () => {
  assert.equal(ROLES.accountant.label, "Accountant");
  assert.equal(
    ROLES.accountant.description,
    "Keeps the books: journals, expenses, reconciliation, period and year-end close, opening balances and the allowance. Assigned by the owner.",
  );
  assert.deepEqual([...ROLES.accountant.permissions].sort(), [...ACCOUNTANT_PERMISSIONS].sort());
  assert.equal(new Set(ROLES.accountant.permissions).size, ROLES.accountant.permissions.length);
});

// Round fz personal-data rule: the Accountant reads the books, not members.
test("the Accountant holds no member permission and no lending write", () => {
  const held = ROLES.accountant.permissions;
  assert.equal(held.some((p) => p.startsWith("borrowers:")), false);
  assert.equal(held.some((p) => p.startsWith("users:") || p.startsWith("settings:")), false);
  for (const p of held.filter((p) => /^(loans|payments|share_capital|gcash|fees):/.test(p))) {
    assert.match(p, /:view$/, p);
  }
});

// super_admin has no entry in this map (see `Role`); the server grants it there.
test("only admin and the Accountant hold accounting:allowance", () => {
  const holders = Object.entries(ROLES)
    .filter(([, config]) => config.permissions.includes("accounting:allowance"))
    .map(([role]) => role)
    .sort();
  assert.deepEqual(holders, ["accountant", "admin"]);
});

// The bookkeeper and the manager are unchanged by round C.
test("general_bookkeeper and manager keep their accounting grants", () => {
  const accounting = (role: "general_bookkeeper" | "manager") =>
    ROLES[role].permissions.filter((p) =>
      /^(accounting|chart_of_accounts|journals|expenses|cash_accounts|branches):/.test(p),
    );
  assert.deepEqual(accounting("general_bookkeeper"), [
    "accounting:view",
    "accounting:reconcile",
    "chart_of_accounts:view",
    "journals:view",
    "journals:create",
    "expenses:view",
    "expenses:create",
    "cash_accounts:view",
  ]);
  assert.deepEqual(accounting("manager"), [
    "accounting:view",
    "chart_of_accounts:view",
    "journals:view",
    "expenses:view",
    "cash_accounts:view",
  ]);
  assert.equal(ROLES.general_bookkeeper.permissions.length, 16);
  assert.equal(ROLES.manager.permissions.length, 16);
});
