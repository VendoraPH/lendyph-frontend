import type { Permission } from "@/types";
import type { LucideIcon } from "lucide-react";
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
} from "lucide-react";

export interface NavSubItem {
  title: string;
  href: string;
}

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
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
      { title: "Amortization", href: "/loans/amortization" },
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
      { title: "Role and Permissions", href: "/settings/user-roles" },
      { title: "Approval Workflow", href: "/settings/approval-workflow" },
    ],
  },
];
