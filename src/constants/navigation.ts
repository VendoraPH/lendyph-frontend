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
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
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
  },
];
