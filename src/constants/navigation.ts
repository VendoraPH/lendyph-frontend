import type { Permission } from "@/types";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  ClipboardList,
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
    title: "User Management",
    href: "/users",
    icon: UserCog,
    permission: "users:view",
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
    title: "Borrowers",
    href: "/borrowers",
    icon: Users,
    permission: "borrowers:view",
    children: [
      { title: "All Borrowers", href: "/borrowers" },
      { title: "New Borrower", href: "/borrowers/new" },
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
      { title: "Loan Products", href: "/loans/products" },
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
    title: "Collections",
    href: "/collections",
    icon: ClipboardList,
    permission: "collections:view",
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
    ],
  },
];
