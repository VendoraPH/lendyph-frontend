import type { Permission, Role, RoleConfig } from "@/types";

/**
 * Every permission lendyph-backend creates (RoleAndPermissionSeeder and the
 * permission migrations). The seeder syncs `Permission::all()` to both
 * super_admin and admin, and each permission migration grants both, so the
 * roles grid seeds them with this list.
 */
const EVERY_PERMISSION: Permission[] = [
  "dashboard:view",
  "borrowers:view",
  "borrowers:create",
  "borrowers:update",
  "borrowers:delete",
  "borrowers:approve",
  "loans:view",
  "loans:create",
  "loans:update",
  "loans:delete",
  "loans:approve",
  "loans:reject",
  "loans:release",
  "loans:void",
  "loans:extend",
  "loans:restructure",
  // Writing off a restructure's shortfall; its own checkbox in the editor.
  "loans:write_off",
  // Creating, editing and deleting loan products. Seeded for admin and
  // super_admin only; viewing products needs just `loans:view`.
  "loan_products:manage",
  // Extensions and balance adjustments; no checkbox in the editor.
  "loan_adjustments:view",
  "loan_adjustments:create",
  "loan_adjustments:approve",
  "payments:view",
  "payments:create",
  "payments:update",
  "payments:void",
  "collections:view",
  "collections:mark_collected",
  "reports:view",
  "reports:export",
  "settings:view",
  "settings:update",
  "settings:delete",
  "fees:view",
  "fees:create",
  "fees:update",
  "fees:delete",
  "users:view",
  "users:create",
  "users:update",
  "users:delete",
  "users:reset_password",
  // Sees every branch's data, not only assigned ones.
  "branches:view_all",
  "audit_logs:view",
  "audit_logs:export",
  "share_capital:view",
  "share_capital:create",
  "share_capital:update",
  "auto_pay:view",
  "auto_pay:process",
  "auto_pay:toggle",
  // Crediting members' share capital in a batch; no checkbox in the editor.
  "auto_credit:process",
  "collaterals:view",
  "collaterals:create",
  "collaterals:update",
  "collaterals:delete",
  "gcash:view",
  "gcash:transact",
  "gcash:settings",
  // CSV migration. Granted to `super_admin` and `admin` only; no other role
  // in this map gets it.
  "imports:process",
  // Accounting — the full set, including the three that move or lock the
  // books: post, reverse and close.
  "accounting:view",
  "accounting:reconcile",
  "accounting:close",
  "accounting:settings",
  // Posting the allowance for credit losses. Seeded for super_admin, admin
  // and accountant only (round C).
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
  // Credit Scoring. Seeded for admin and super_admin only (lendyph-backend
  // #174); its endpoints answer 501 until they are built, so the screens
  // show "Not connected yet". Other roles get it only through the roles
  // screen.
  "credit_scoring:view",
  "credit_scoring:override",
  // `:settings`, not `:configure` — the design spec originally said
  // `configure` (since corrected, but older copies were not). A backend
  // seeded from that wording creates a permission nothing here reads.
  "credit_scoring:settings",
  // Reminders (Phase 2). Seeded for admin and super_admin only; other
  // roles get them only through the roles screen. `:settings` holds the
  // SMS/email provider credentials.
  "reminders:view",
  "reminders:send",
  "reminders:pause",
  "reminders:settings",
];

/**
 * What each role is DOCUMENTED to have — the roles screen reads this to seed a
 * role's permission grid and to label it.
 *
 * It is not the gate. Every guard in the app (`RouteGuard`, `PermissionGate`,
 * `usePermission().can`) asks the auth store, which holds `user.permissions`
 * as the server sent them. So editing this map cannot grant anyone anything,
 * and a role whose server-side grants have drifted from this list will still
 * behave exactly as the server says.
 */
export const ROLES: Record<Role, RoleConfig> = {
  // The platform team's role. It labels the role; it is never offered as a
  // choice (see ROLE_OPTIONS).
  super_admin: {
    label: "Super Admin",
    description:
      "Platform super administrator — holds every permission. Reserved for the platform team, not client staff.",
    permissions: [...EVERY_PERMISSION],
  },
  admin: {
    label: "Admin",
    description: "Full access to all modules",
    permissions: [...EVERY_PERMISSION],
  },
  // Mirrors `RoleAndPermissionSeeder::ACCOUNTANT_PERMISSIONS` exactly (round C).
  // Every accounting permission and every branch, but only read access to the
  // lending side, and no `borrowers:view` (round fz personal-data rule), users
  // or settings. No `audit_logs:view` either: audit rows carry members'
  // personal data (backend #249 review).
  accountant: {
    label: "Accountant",
    description:
      "Keeps the books: journals, expenses, reconciliation, period and year-end close, opening balances and the allowance. Assigned by the owner.",
    permissions: [
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
    ],
  },
  loan_officer: {
    label: "Loan Officer",
    description: "Manage loans and members",
    permissions: [
      "dashboard:view",
      "borrowers:view",
      "borrowers:create",
      "borrowers:update",
      "loans:view",
      "loans:create",
      "loans:update",
      "loans:approve",
      "loans:reject",
      "loans:release",
      "payments:view",
      "collections:view",
      "reports:view",
      "share_capital:view",
      "share_capital:create",
      "collaterals:view",
      "collaterals:create",
      "collaterals:update",
    ],
  },
  cashier: {
    label: "Cashier",
    description: "Record payments and view members",
    permissions: [
      "dashboard:view",
      "borrowers:view",
      "loans:view",
      "payments:view",
      "payments:create",
      "payments:update",
      "payments:void",
      "collaterals:view",
      "gcash:view",
      "gcash:transact",
    ],
  },
  general_bookkeeper: {
    label: "General Bookkeeper",
    description: "Releases approved loans after chairwoman confirmation",
    permissions: [
      "dashboard:view",
      "borrowers:view",
      "loans:view",
      "loans:release",
      "payments:view",
      "reports:view",
      "share_capital:view",
      "collaterals:view",
      // Accounting, at bookkeeper level: drafts entries, records expenses and
      // reconciles accounts. Pointedly WITHOUT `journals:post`,
      // `journals:reverse` or `accounting:close` — drafting is reversible,
      // posting moves the books, and keeping the two apart is what makes the
      // preparer/approver split real rather than advisory.
      "accounting:view",
      "accounting:reconcile",
      "chart_of_accounts:view",
      "journals:view",
      "journals:create",
      "expenses:view",
      "expenses:create",
      "cash_accounts:view",
    ],
  },
  collector: {
    label: "Collector",
    description: "View and manage collections",
    permissions: [
      "borrowers:view",
      "loans:view",
      "collections:view",
      "collections:mark_collected",
      "collaterals:view",
    ],
  },
  viewer: {
    label: "Viewer",
    description: "Read-only access to dashboard and reports",
    permissions: ["dashboard:view", "reports:view", "collaterals:view"],
  },
  loan_processor: {
    label: "Loan Processor",
    description: "Prepares and submits loan drafts for approval; handles revisions from approvers",
    permissions: [
      "dashboard:view",
      "borrowers:view",
      "borrowers:create",
      "borrowers:update",
      "loans:view",
      "loans:create",
      "loans:update",
      "reports:view",
      "share_capital:view",
      "collaterals:view",
      "collaterals:create",
      "collaterals:update",
    ],
  },
  manager: {
    label: "Manager",
    description: "Branch manager — first-level approver in the loan approval chain",
    permissions: [
      "dashboard:view",
      "borrowers:view",
      "loans:view",
      "loans:approve",
      "loans:reject",
      "payments:view",
      "reports:view",
      "share_capital:view",
      "audit_logs:view",
      "users:view",
      "collaterals:view",
      // Read-only accounting for their own branch. The branch restriction is
      // enforced server-side from the user's branch assignment, not here — this
      // grant only says "may look at accounting", never "at all of it".
      "accounting:view",
      "chart_of_accounts:view",
      "journals:view",
      "expenses:view",
      "cash_accounts:view",
    ],
  },
  bod1: {
    label: "BOD1",
    description: "Board of Directors member 1 — second-level approver",
    permissions: [
      "dashboard:view",
      "borrowers:view",
      "loans:view",
      "loans:approve",
      "loans:reject",
      "reports:view",
      "share_capital:view",
      "collaterals:view",
    ],
  },
  bod2: {
    label: "BOD2",
    description: "Board of Directors member 2 — third-level approver",
    permissions: [
      "dashboard:view",
      "borrowers:view",
      "loans:view",
      "loans:approve",
      "loans:reject",
      "reports:view",
      "share_capital:view",
      "collaterals:view",
    ],
  },
  bod3: {
    label: "BOD3",
    description: "Board of Directors member 3 — fourth-level approver",
    permissions: [
      "dashboard:view",
      "borrowers:view",
      "loans:view",
      "loans:approve",
      "loans:reject",
      "reports:view",
      "share_capital:view",
      "collaterals:view",
    ],
  },
  bod4: {
    label: "BOD4",
    description: "Board of Directors member 4 — fifth-level approver",
    permissions: [
      "dashboard:view",
      "borrowers:view",
      "loans:view",
      "loans:approve",
      "loans:reject",
      "reports:view",
      "share_capital:view",
      "collaterals:view",
    ],
  },
  bod5: {
    label: "BOD5",
    description: "Board of Directors member 5 — sixth-level approver",
    permissions: [
      "dashboard:view",
      "borrowers:view",
      "loans:view",
      "loans:approve",
      "loans:reject",
      "reports:view",
      "share_capital:view",
      "collaterals:view",
    ],
  },
  bod6: {
    label: "BOD6",
    description: "Board of Directors member 6 — seventh-level approver",
    permissions: [
      "dashboard:view",
      "borrowers:view",
      "loans:view",
      "loans:approve",
      "loans:reject",
      "reports:view",
      "share_capital:view",
      "collaterals:view",
    ],
  },
  bod7: {
    label: "BOD7",
    description: "Board of Directors member 7 — final approver in the chain",
    permissions: [
      "dashboard:view",
      "borrowers:view",
      "loans:view",
      "loans:approve",
      "loans:reject",
      "reports:view",
      "share_capital:view",
      "collaterals:view",
    ],
  },
};

/**
 * The roles a picker may offer: every catalog role but `super_admin`, which is
 * reserved for the platform team and never assigned from the app.
 */
export const ROLE_OPTIONS = Object.entries(ROLES)
  .filter(([value]) => value !== "super_admin")
  .map(([value, config]) => ({
    value: value as Role,
    label: config.label,
    description: config.description,
  }));
