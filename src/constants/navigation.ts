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
  FilePlus,
  Package,
  Landmark,
  ShieldCheck,
  BookOpenCheck,
} from "lucide-react";
import { GCashIcon } from "@/components/icons/gcash-icon";
import { env } from "@/config/env";

export interface NavSubItem {
  title: string;
  href: string;
  /**
   * Optional, and optional on purpose: a child with no permission of its own is
   * covered by its parent's, which is true of every child that shipped before
   * this field existed — "New Member" needs nothing beyond `borrowers:view`
   * to be a fair offer.
   *
   * Set it when the child's route guards on something STRICTER than the parent.
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
      { title: "New Member", href: "/borrowers/new" },
    ],
  },
  {
    title: "Loans",
    href: "/loans",
    icon: FileText,
    permission: "loans:view",
    children: [
      { title: "All Loans", href: "/loans" },
      { title: "New Application", href: "/loans/new" },
      { title: "Amortization Calculator", href: "/loans/amortization" },
      // binhs-coop only — gated on NEXT_PUBLIC_ENABLE_BINHS_AMORTIZATION at
      // build time. The route itself also 404s when the flag is off.
      ...(env.features.binhsAmortization
        ? [{ title: "Amortization BINHS", href: "/loans/amortization-binhs" }]
        : []),
      { title: "Restructure", href: "/loans/restructure" },
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
      { title: "Auto-Pay", href: "/payments/auto-pay" },
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
      { title: "Auto-Credit", href: "/share-capital/auto-credit" },
    ],
  },
  {
    title: "Collateral",
    href: "/collaterals",
    icon: ShieldCheck,
    permission: "collaterals:view",
    children: [
      { title: "Collateral Listing", href: "/collaterals" },
      { title: "Collateral Entry", href: "/collaterals/new" },
    ],
  },
  {
    title: "GCash",
    href: "/gcash",
    icon: GCashIcon,
    permission: "gcash:view",
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
      { title: "Fees", href: "/settings/fees" },
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
