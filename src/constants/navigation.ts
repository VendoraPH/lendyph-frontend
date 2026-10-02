import type { Permission } from "@/types";
import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,

  BarChart3,
  FileStack,
  Settings,
  UserCog,
  History,
  Landmark,
  ShieldCheck,
  BookOpenCheck,
  Gauge,
} from "lucide-react";
import { GCashIcon } from "@/components/icons/gcash-icon";
import { env } from "@/config/env";

export interface NavSubItem {
  title: string;
  href: string;
  /**
   * Optional, and optional on purpose: a child with no permission of its own is
   * covered by its parent's, which is right for a page that guards on the same
   * permission as its parent ("All Members", "Payment History").
   *
   * Set it when the child's route guards on something STRICTER than the parent,
   * matching that page's RouteGuard: "New Member" needs `borrowers:create`, not
   * just the `borrowers:view` that shows Members.
   * `/settings/data-import` is the first: Settings opens on `settings:view`,
   * which a manager has, while the import itself needs `imports:process`,
   * which only an admin has. Without this the sidebar would show the link to
   * everyone who can see Settings and land them on AccessDenied.
   */
  permission?: Permission;
}

export interface NavItem {
  title: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  permission: Permission;
  children?: NavSubItem[];
}

export const SIDEBAR_NAV: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard:view",
  },
  {
    title: "Members",
    href: "/borrowers",
    icon: Users,
    permission: "borrowers:view",
    children: [
      { title: "All Members", href: "/borrowers" },
      { title: "New Member", href: "/borrowers/new", permission: "borrowers:create" },
    ],
  },
  {
    title: "Loans",
    href: "/loans",
    icon: FileText,
    permission: "loans:view",
    children: [
      { title: "All Loans", href: "/loans" },
      { title: "New Application", href: "/loans/new", permission: "loans:create" },
      { title: "Amortization Calculator", href: "/loans/amortization" },
      // binhs-coop only — gated on NEXT_PUBLIC_ENABLE_BINHS_AMORTIZATION at
      // build time. The route itself also 404s when the flag is off.
      ...(env.features.binhsAmortization
        ? [{ title: "Amortization BINHS", href: "/loans/amortization-binhs" }]
        : []),
      { title: "Restructure", href: "/loans/restructure", permission: "loans:restructure" },
      // Hidden until the server grants `reminders:view`, which it must not do
      // before the reminder routes ship (see `@/constants/rbac`). The six
      // reminder screens are tabs inside /loans/reminders, not menu items.
      { title: "Reminders", href: "/loans/reminders", permission: "reminders:view" },
    ],
  },
  {
    title: "Payments",
    href: "/payments",
    icon: CreditCard,
    permission: "payments:view",
    children: [
      { title: "New Payment", href: "/payments" },
      { title: "Payment History", href: "/payments/history" },
      { title: "Auto-Pay", href: "/payments/auto-pay", permission: "auto_pay:view" },
    ],
  },
  {
    title: "Share Capital",
    href: "/share-capital",
    icon: Landmark,
    permission: "share_capital:view",
    children: [
      { title: "Subsidiary Ledger", href: "/share-capital/ledger" },
      { title: "Pledge Entry", href: "/share-capital/pledges" },
      { title: "Auto-Credit", href: "/share-capital/auto-credit", permission: "share_capital:create" },
    ],
  },
  {
    title: "Collateral",
    href: "/collaterals",
    icon: ShieldCheck,
    permission: "collaterals:view",
    children: [
      { title: "Collateral Listing", href: "/collaterals" },
      { title: "Collateral Entry", href: "/collaterals/new", permission: "collaterals:create" },
    ],
  },
  {
    title: "GCash",
    href: "/gcash",
    icon: GCashIcon,
    permission: "gcash:view",
  },
  {
    title: "Credit Scoring",
    href: "/credit-scoring",
    icon: Gauge,
    permission: "credit_scoring:view",
    /**
     * The backend seeds `credit_scoring:view|override|settings` for admin and
     * super_admin only (lendyph-backend #174, 2026-10-02), and every endpoint
     * behind these seven destinations answers 501 until it is built. Each
     * screen then shows its "Not connected yet" panel: `useApiResource` treats
     * 404 and 501 as "not built yet" and anything else as an error, so a real
     * endpoint must not ship as a 403/500 stub.
     *
     * The server's permissions are the only gate. `RouteGuard` reads the same
     * `user.permissions` from the auth store as the sidebar, so granting
     * `credit_scoring:view` to another role shows it this menu at once.
     *
     * Note the name: the two admin screens gate on `credit_scoring:settings`,
     * NOT `:configure`. The design spec originally said `configure` and has
     * since been corrected; older copies of it have not. The code is
     * authoritative, and it mirrors `accounting:settings`.
     *
     * Contract for whoever builds it: `docs/CREDIT_SCORING_BACKEND_HANDOFF.md`.
     *
     * Children that need a stricter permission than the parent's
     * `credit_scoring:view` say so; the rest repeat it explicitly.
     */
    children: [
      { title: "Dashboard", href: "/credit-scoring", permission: "credit_scoring:view" },
      { title: "Borrower Scores", href: "/credit-scoring/borrowers", permission: "credit_scoring:view" },
      { title: "Credit Assessment", href: "/credit-scoring/assessment", permission: "credit_scoring:view" },
      { title: "Scorecard Configuration", href: "/credit-scoring/scorecard-configuration", permission: "credit_scoring:settings" },
      { title: "Risk Monitoring", href: "/credit-scoring/risk-monitoring", permission: "credit_scoring:view" },
      { title: "Score History", href: "/credit-scoring/score-history", permission: "credit_scoring:view" },
      { title: "Settings", href: "/credit-scoring/settings", permission: "credit_scoring:settings" },
    ],
  },
  {
    title: "Accounting",
    href: "/accounting",
    icon: BookOpenCheck,
    permission: "accounting:view",
    /**
     * Thirteen children, which is the most any menu here has. Two of them —
     * Financial Statements and Accounting Books — have a third level in the
     * spec (Balance Sheet, Income Statement, … / General Journal, Cash
     * Receipts, …). `NavSubItem` has no `children`, and rather than grow the
     * nav model for two entries, each of those pages carries its own tabs.
     * Same destinations, one less level of chrome to collapse and expand.
     *
     * Children that need a stricter permission than the parent's
     * `accounting:view` say so; the rest inherit it.
     */
    children: [
      { title: "Dashboard", href: "/accounting" },
      { title: "Chart of Accounts", href: "/accounting/chart-of-accounts", permission: "chart_of_accounts:view" },
      { title: "Journal Entries", href: "/accounting/journals", permission: "journals:view" },
      { title: "Cash & Bank", href: "/accounting/cash-bank", permission: "cash_accounts:view" },
      { title: "Expenses & Payables", href: "/accounting/expenses", permission: "expenses:view" },
      { title: "Loan Accounting", href: "/accounting/loans" },
      { title: "General Ledger", href: "/accounting/general-ledger" },
      { title: "Trial Balance", href: "/accounting/trial-balance" },
      { title: "Reconciliation", href: "/accounting/reconciliation", permission: "accounting:reconcile" },
      { title: "Financial Statements", href: "/accounting/statements" },
      { title: "Accounting Books", href: "/accounting/books" },
      { title: "Period Closing", href: "/accounting/period-closing", permission: "accounting:close" },
      { title: "Settings", href: "/accounting/settings", permission: "accounting:settings" },
    ],
  },
  {
    title: "User Management",
    href: "/users",
    icon: UserCog,
    permission: "users:view",
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    permission: "reports:view",
  },
  {
    title: "Documents",
    href: "/printables",
    icon: FileStack,
    // Same gate as Reports: both read the whole book — every loan, member and
    // payment — so they stand or fall on the same permission.
    permission: "reports:view",
  },
  {
    title: "Audit Trail",
    href: "/audit-trail",
    icon: History,
    permission: "audit_logs:view",
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    permission: "settings:view",
    children: [
      { title: "Profile", href: "/settings/profile" },
      { title: "Branding", href: "/settings/branding" },
      { title: "Branches", href: "/settings/branches" },
      { title: "Loan Products", href: "/settings/loan-products" },
      { title: "Fees", href: "/settings/fees", permission: "fees:view" },
      { title: "Collateral Types", href: "/settings/collateral-types" },
      { title: "Role and Permissions", href: "/settings/user-roles" },
      { title: "Approval Workflow", href: "/settings/approval-workflow" },
      { title: "GCash", href: "/settings/gcash" },
      // Lives under Settings because it is admin-only, org-wide, one-time
      // config — and because it belongs to neither Members nor Loans: a single
      // run writes both.
      {
        title: "Data Import",
        href: "/settings/data-import",
        permission: "imports:process",
      },
    ],
  },
];
