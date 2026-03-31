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
    title: "Users",
    href: "/users",
    icon: UserCog,
    permission: "users:view",
  },
  {
    title: "Borrowers",
    href: "/borrowers",
    icon: Users,
    permission: "borrowers:view",
  },
  {
    title: "Loans",
    href: "/loans",
    icon: FileText,
    permission: "loans:view",
    children: [
      { title: "New Application", href: "/loans/new" },
    ],
  },
  {
    title: "Payments",
    href: "/payments",
    icon: CreditCard,
    permission: "payments:view",
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
      { title: "Loan Products", href: "/settings/loan-products" },
    ],
  },
];
