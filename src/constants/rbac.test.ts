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
// only (savings design §3); other roles get them through the roles screen. The
// Compliance Officer (Phase 6) reads savings, read-only.
test("admin and super_admin hold all seven savings permissions, and no other role but the Compliance Officer's view holds one", () => {
  for (const [role, config] of Object.entries(ROLES)) {
    const held = config.permissions.filter((p) => p.startsWith("savings:"));
    const expected =
      role === "admin" || role === "super_admin" ? SAVINGS : role === "compliance_officer" ? ["savings:view"] : [];
    assert.deepEqual(held, expected, role);
  }
});

// Phase 3: the sixteen CDA permissions (`CdaAccess::PERMISSIONS`, backend #277)
// are seeded for admin and super_admin only.
const CDA = [
  "cda:view",
  "cda:prepare",
  "cda:upload",
  "cda:review",
  "cda:approve",
  "cda:finalize",
  "cda:reopen",
  "cda:submit",
  "cda:export",
  "cda:settings",
  "cda:manage_officers",
  "cda:manage_social",
  "cda:manage_mediation",
  "cda:view_mediation",
  "cda:view_audit",
  "cda:view_tax",
];

test("admin and super_admin hold all sixteen CDA permissions, and no other role holds one", () => {
  for (const [role, config] of Object.entries(ROLES)) {
    const held = config.permissions.filter((p) => p.startsWith("cda:"));
    assert.deepEqual(held, role === "admin" || role === "super_admin" ? CDA : [], role);
  }
});

// Phase 3: the six Member Portal staff permissions (backend migration
// 2026_11_11_700200) are seeded for admin and super_admin only.
const MEMBER_PORTAL = [
  "member_portal:view",
  "member_portal:invite",
  "member_portal:manage",
  "member_portal:requests",
  "member_portal:announcements",
  "member_portal:settings",
];

test("admin and super_admin hold all six Member Portal permissions, and no other role holds one", () => {
  for (const [role, config] of Object.entries(ROLES)) {
    const held = config.permissions.filter((p) => p.startsWith("member_portal:"));
    assert.deepEqual(held, role === "admin" || role === "super_admin" ? MEMBER_PORTAL : [], role);
  }
});

// Phase 4 (B2): Settings → Penalties' four permissions are seeded for admin
// and super_admin only.
test("admin and super_admin hold all four penalties permissions, and no other role holds one", () => {
  const PENALTIES = ["penalties:view", "penalties:create", "penalties:update", "penalties:delete"];
  for (const [role, config] of Object.entries(ROLES)) {
    const held = config.permissions.filter((p) => p.startsWith("penalties:"));
    assert.deepEqual(held, role === "admin" || role === "super_admin" ? PENALTIES : [], role);
  }
});

// Linda v1: `linda:use` and `linda:settings` are seeded for admin and
// super_admin only, in the backend's Linda permission migration and the seeder.
test("admin and super_admin hold both Linda permissions, and no other role holds one", () => {
  for (const [role, config] of Object.entries(ROLES)) {
    const held = config.permissions.filter((p) => p.startsWith("linda:"));
    assert.deepEqual(held, role === "admin" || role === "super_admin" ? ["linda:use", "linda:settings"] : [], role);
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
// The seven savings permissions come with Phase 3's savings foundation (S1),
// the sixteen CDA permissions with the CDA foundation (backend #277), and the
// six Member Portal permissions with the portal foundation (backend #287), and
// the two Linda permissions with Linda v1, and Phase 6's keys with X0.
const BACKEND_PERMISSIONS = [
  "amla:alerts",
  "amla:approve",
  "amla:audit",
  "amla:cases",
  "amla:cdd",
  "amla:ctr",
  "amla:export",
  "amla:sanctions",
  "amla:screening",
  "amla:settings",
  "amla:str",
  "amla:submit",
  "amla:view",
  "borrowers:transfer",
  "branches:manage",
  "dashboard:analytics",
  "dashboard:export",
  "dashboard:settings",
  "interbranch_transfers:approve",
  "interbranch_transfers:create",
  "interbranch_transfers:receive",
  "interbranch_transfers:view",
  "loan_origination:assess",
  "loan_origination:convert",
  "loan_origination:settings",
  "loan_origination:update",
  "loan_origination:view",
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
  "cda:approve",
  "cda:export",
  "cda:finalize",
  "cda:manage_mediation",
  "cda:manage_officers",
  "cda:manage_social",
  "cda:prepare",
  "cda:reopen",
  "cda:review",
  "cda:settings",
  "cda:submit",
  "cda:upload",
  "cda:view",
  "cda:view_audit",
  "cda:view_mediation",
  "cda:view_tax",
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
  "linda:settings",
  "linda:use",
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
  // The Chairman/Chairwoman's edit at their approval step (finish run round 2).
  "loans:edit_in_approval",
  "member_portal:announcements",
  "member_portal:invite",
  "member_portal:manage",
  "member_portal:requests",
  "member_portal:settings",
  "member_portal:view",
  "payments:create",
  "payments:update",
  "payments:view",
  "payments:void",
  "penalties:create",
  "penalties:delete",
  "penalties:update",
  "penalties:view",
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
  "menu_visibility:manage",
];

// Held by the Chairman/Chairwoman's role (`bod1`) alone: RoleAndPermissionSeeder
// keeps it out of super_admin's and admin's Permission::all() sync.
const CHAIR_ONLY = ["loans:edit_in_approval"];

/** Every backend permission but the Chair's own. */
const ADMINS_HOLD = BACKEND_PERMISSIONS.filter((permission) => !CHAIR_ONLY.includes(permission));

test("super_admin is labelled in words and holds every backend permission but the Chair's own", () => {
  assert.equal(ROLES.super_admin.label, "Super Admin");
  assert.equal(
    ROLES.super_admin.description,
    "Platform super administrator — holds every permission. Reserved for the platform team, not client staff.",
  );
  assert.deepEqual([...ROLES.super_admin.permissions].sort(), [...ADMINS_HOLD].sort());
  assert.equal(new Set(ROLES.super_admin.permissions).size, ROLES.super_admin.permissions.length);
});

// A label for screens that name the role, never a choice: super_admin is
// reserved for the platform team, so no role list built from this map offers it.
test("ROLE_OPTIONS never offers super_admin", () => {
  assert.equal(ROLE_OPTIONS.some((option) => option.value === "super_admin"), false);
  assert.ok(ROLE_OPTIONS.some((option) => option.value === "admin"));
});

// RoleAndPermissionSeeder syncs Permission::all() to admin too, and each
// permission migration grants admin, so the catalog documents admin with all
// but the Chair's own.
test("admin holds every backend permission but the Chair's own", () => {
  assert.deepEqual([...ROLES.admin.permissions].sort(), [...ADMINS_HOLD].sort());
  assert.equal(new Set(ROLES.admin.permissions).size, ROLES.admin.permissions.length);
});

// Phase 6 (X0): every new key is seeded for admin and super_admin only. The
// Compliance Officer also holds the thirteen AMLA keys; nobody else holds any.
const PHASE6 = [
  "amla:view",
  "amla:alerts",
  "amla:cases",
  "amla:cdd",
  "amla:screening",
  "amla:sanctions",
  "amla:ctr",
  "amla:str",
  "amla:approve",
  "amla:export",
  "amla:submit",
  "amla:settings",
  "amla:audit",
  "dashboard:analytics",
  "dashboard:export",
  "dashboard:settings",
  "branches:manage",
  "borrowers:transfer",
  "interbranch_transfers:view",
  "interbranch_transfers:create",
  "interbranch_transfers:approve",
  "interbranch_transfers:receive",
  "loan_origination:view",
  "loan_origination:update",
  "loan_origination:assess",
  "loan_origination:convert",
  "loan_origination:settings",
];
const AMLA = PHASE6.filter((p) => p.startsWith("amla:"));

test("admin and super_admin hold every Phase 6 permission", () => {
  for (const role of ["admin", "super_admin"] as const) {
    for (const permission of PHASE6) assert.ok(ROLES[role].permissions.includes(permission as never), `${role} ${permission}`);
  }
});

test("no other role holds a Phase 6 permission, but the Compliance Officer's AMLA keys", () => {
  for (const [role, config] of Object.entries(ROLES)) {
    if (role === "admin" || role === "super_admin") continue;
    const held = config.permissions.filter((p) => PHASE6.includes(p));
    assert.deepEqual(held, role === "compliance_officer" ? AMLA : [], role);
  }
});

// Copied from lendyph-backend `RoleAndPermissionSeeder::COMPLIANCE_OFFICER_PERMISSIONS`
// (Phase 6, X0; AMLA analysis §4.12): every AMLA key, every branch, and
// read-only lending, savings and GCash. Assigned by the owner.
const COMPLIANCE_OFFICER_PERMISSIONS = [
  ...AMLA,
  "branches:view_all",
  "borrowers:view",
  "reports:view",
  "dashboard:view",
  "loans:view",
  "loan_adjustments:view",
  "payments:view",
  "collaterals:view",
  "fees:view",
  "share_capital:view",
  "auto_pay:view",
  "savings:view",
  "gcash:view",
];

test("the Compliance Officer is labelled in words and holds exactly the server's list", () => {
  assert.equal(ROLES.compliance_officer.label, "Compliance Officer");
  assert.equal(
    ROLES.compliance_officer.description,
    "Anti-money laundering compliance: alerts, cases, due diligence, screening, sanctions, covered and suspicious transaction reports and the AMLA log, with read-only lending, savings and GCash in every branch. Assigned by the owner.",
  );
  assert.deepEqual([...ROLES.compliance_officer.permissions].sort(), [...COMPLIANCE_OFFICER_PERMISSIONS].sort());
  assert.equal(new Set(ROLES.compliance_officer.permissions).size, ROLES.compliance_officer.permissions.length);
});

test("the Compliance Officer writes nothing outside AMLA", () => {
  for (const p of ROLES.compliance_officer.permissions.filter((p) => !p.startsWith("amla:"))) {
    assert.match(p, /:view(_all)?$/, p);
  }
});

// The Chairman/Chairwoman edits a loan at their approval step: `bod1` alone is
// documented with it, as the backend seeds it.
test("only the Chair's role holds loans:edit_in_approval", () => {
  const holders = Object.entries(ROLES)
    .filter(([, config]) => config.permissions.includes("loans:edit_in_approval"))
    .map(([role]) => role);
  assert.deepEqual(holders, ["bod1"]);
});

test("admin and super_admin are documented with menu_visibility:manage, as the server seeds it", () => {
  for (const role of ["admin", "super_admin"] as const) {
    assert.ok(ROLES[role].permissions.includes("menu_visibility:manage"), role);
  }
  assert.equal(ROLES.accountant.permissions.includes("menu_visibility:manage"), false);
});
