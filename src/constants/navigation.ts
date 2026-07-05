import type { Permission } from "@/types";
import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,

  BarChart3,
  Settings,
  UserCog,
  History,
  FilePlus,
  Package,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import { GCashIcon } from "@/components/icons/gcash-icon";

export interface NavSubItem {
  title: string;
  href: string;
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
      { title: "Amortization BINHS", href: "/loans/amortization-binhs" },
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
      { title: "Branches", href: "/settings/branches" },
      { title: "Loan Products", href: "/settings/loan-products" },
      { title: "Fees", href: "/settings/fees" },
      { title: "Collateral Types", href: "/settings/collateral-types" },
      { title: "Role and Permissions", href: "/settings/user-roles" },
      { title: "Approval Workflow", href: "/settings/approval-workflow" },
      { title: "GCash", href: "/settings/gcash" },
    ],
  },
];
