import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLES, ROLE_OPTIONS } from "./rbac";

const REMINDERS = ["reminders:view", "reminders:send", "reminders:pause", "reminders:settings"];

// Phase 2: the four reminders permissions are seeded for admin and
// super_admin only.
test("admin and super_admin hold all four reminders permissions", () => {
  for (const role of ["admin", "super_admin"] as const) {
    assert.deepEqual(
      ROLES[role].permissions.filter((p) => p.startsWith("reminders:")),
      REMINDERS,
      role,
    );
  }
});

test("no role but admin and super_admin holds a reminders permission", () => {
  for (const [role, config] of Object.entries(ROLES)) {
    if (role === "admin" || role === "super_admin") continue;
    assert.deepEqual(
      config.permissions.filter((p) => p.startsWith("reminders:")),
      [],
      role,
    );
  }
});

const SAVINGS = [
  "savings:view",
  "savings:create",
  "savings:transact",
  "savings:close",
  "savings:approve",
  "savings:post",
  "savings:settings",
];

// Phase 3: the seven savings permissions are seeded for admin and super_admin
// only (savings design §3); other roles get them through the roles screen.
test("admin and super_admin hold all seven savings permissions, and no other role holds one", () => {
  for (const [role, config] of Object.entries(ROLES)) {
    const held = config.permissions.filter((p) => p.startsWith("savings:"));
    assert.deepEqual(held, role === "admin" || role === "super_admin" ? SAVINGS : [], role);
  }
});

// Copied from lendyph-backend `RoleAndPermissionSeeder::ACCOUNTANT_PERMISSIONS`
// (round C, slice C1, after the review fix on #249 removed `audit_logs:view`,
// whose rows carry members' personal data). `ROLES.accountant` documents the
// role, so it must match the server's list exactly.
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
  // Audit rows carry members' personal data (backend #249 review).
  assert.equal(held.some((p) => p.startsWith("audit_logs:")), false);
  assert.equal(held.some((p) => p.startsWith("users:") || p.startsWith("settings:")), false);
  for (const p of held.filter((p) => /^(loans|payments|share_capital|gcash|fees):/.test(p))) {
    assert.match(p, /:view$/, p);
  }
});

test("only super_admin, admin and the Accountant hold accounting:allowance", () => {
  const holders = Object.entries(ROLES)
    .filter(([, config]) => config.permissions.includes("accounting:allowance"))
    .map(([role]) => role)
    .sort();
  assert.deepEqual(holders, ["accountant", "admin", "super_admin"]);
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

// Every permission lendyph-backend creates (RoleAndPermissionSeeder plus the
// permission migrations), which super_admin holds through Permission::all().
// The seven savings permissions come with Phase 3's savings foundation (S1).
const BACKEND_PERMISSIONS = [
  "accounting:allowance",
  "accounting:close",
  "accounting:reconcile",
  "accounting:settings",
  "accounting:view",
  "audit_logs:export",
  "audit_logs:view",
  "auto_credit:process",
  "auto_pay:process",
  "auto_pay:toggle",
  "auto_pay:view",
  "borrowers:approve",
  "borrowers:create",
  "borrowers:delete",
  "borrowers:update",
  "borrowers:view",
  "branches:view_all",
  "cash_accounts:transfer",
  "cash_accounts:view",
  "chart_of_accounts:create",
  "chart_of_accounts:delete",
  "chart_of_accounts:update",
  "chart_of_accounts:view",
  "collaterals:create",
  "collaterals:delete",
  "collaterals:update",
  "collaterals:view",
  "collections:mark_collected",
  "collections:view",
  "credit_scoring:override",
  "credit_scoring:settings",
  "credit_scoring:view",
  "dashboard:view",
  "expenses:create",
  "expenses:pay",
  "expenses:update",
  "expenses:view",
  "fees:create",
  "fees:delete",
  "fees:update",
  "fees:view",
  "gcash:settings",
  "gcash:transact",
  "gcash:view",
  "imports:process",
  "journals:create",
  "journals:post",
  "journals:reverse",
  "journals:view",
  "loan_adjustments:approve",
  "loan_adjustments:create",
  "loan_adjustments:view",
  "loan_products:manage",
  "loans:approve",
  "loans:create",
  "loans:delete",
  "loans:extend",
  "loans:reject",
  "loans:release",
  "loans:restructure",
  "loans:update",
  "loans:view",
  "loans:void",
  "loans:write_off",
  "payments:create",
  "payments:update",
  "payments:view",
  "payments:void",
  "reminders:pause",
  "reminders:send",
  "reminders:settings",
  "reminders:view",
  "reports:export",
  "reports:view",
  "savings:approve",
  "savings:close",
  "savings:create",
  "savings:post",
  "savings:settings",
  "savings:transact",
  "savings:view",
  "settings:delete",
  "settings:update",
  "settings:view",
  "share_capital:create",
  "share_capital:update",
  "share_capital:view",
  "users:create",
  "users:delete",
  "users:reset_password",
  "users:update",
  "users:view",
];

test("super_admin is labelled in words and holds exactly every backend permission", () => {
  assert.equal(ROLES.super_admin.label, "Super Admin");
  assert.equal(
    ROLES.super_admin.description,
    "Platform super administrator — holds every permission. Reserved for the platform team, not client staff.",
  );
  assert.deepEqual([...ROLES.super_admin.permissions].sort(), [...BACKEND_PERMISSIONS].sort());
  assert.equal(new Set(ROLES.super_admin.permissions).size, ROLES.super_admin.permissions.length);
});

// A label for screens that name the role, never a choice: super_admin is
// reserved for the platform team, so no role list built from this map offers it.
test("ROLE_OPTIONS never offers super_admin", () => {
  assert.equal(ROLE_OPTIONS.some((option) => option.value === "super_admin"), false);
  assert.ok(ROLE_OPTIONS.some((option) => option.value === "admin"));
});

// RoleAndPermissionSeeder syncs Permission::all() to admin too, and each
// permission migration grants admin, so the catalog documents admin with all.
test("admin holds exactly every backend permission", () => {
  assert.deepEqual([...ROLES.admin.permissions].sort(), [...BACKEND_PERMISSIONS].sort());
  assert.equal(new Set(ROLES.admin.permissions).size, ROLES.admin.permissions.length);
});
