import type { Permission } from "@/types";
import type { PermissionRequirement } from "@/lib/permission-requirement";
import type { ComponentType } from "react";
import type { Icon3DName } from "@/lib/icons-3d";
import {
  FileUp,
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
  PiggyBank,
  ClipboardCheck,
  MonitorSmartphone,
  Sparkles,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { GCashIcon } from "@/components/icons/gcash-icon";
import { env } from "@/config/env";
import { MODULE_ALSO_REQUIRES } from "@/lib/permission-module-names";
import { meetsPermission } from "@/lib/permission-requirement";
import { AMLA_SETTINGS_PAGE_PERMISSIONS } from "@/lib/amla/access";
import { AMLA_RISK_RULES_PERMISSIONS } from "@/lib/amla/monitoring-access";
import { AMLA_CTR_READ, AMLA_REPORT_READ, AMLA_STR_READ } from "@/lib/amla/case-access";
import { EXECUTIVE_DASHBOARD_PERMISSION } from "@/app/(app)/dashboard/_lib/executive-access";
import type { MenuModuleKey } from "./menu-modules";

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
   *
   * A list means any one of them is enough, matching a `RouteGuard` given
   * the same list.
   */
  permission?: PermissionRequirement;
  /**
   * Permissions needed as well as `permission`, every one of them: Settings →
   * Member Portal is company-wide, so it also needs `branches:view_all`.
   */
  alsoRequires?: Permission[];
  /**
   * The Menu Visibility module this page belongs to, when it isn't its
   * section's: a submenu with its own switch (Reminders, Auto-Pay) or a
   * Settings page of a module (Accounting, Savings). Hidden with it.
   */
  module?: MenuModuleKey;
}

export interface NavItem {
  title: string;
  href: string;
  /** The line icon, for the command palette and items without a 3D icon. */
  icon: ComponentType<{ className?: string }>;
  /**
   * The side menu's 3D icon (`@/lib/icons-3d`). Linda (her face) and GCash
   * (its brand mark) have none and keep their own picture.
   */
  icon3d?: Icon3DName;
  permission: Permission;
  /**
   * Permissions needed as well as `permission`, every one of them. CDA
   * Compliance covers the whole cooperative, so it also needs
   * `branches:view_all`, as each of its pages does.
   */
  alsoRequires?: Permission[];
  /**
   * When set, the section shows for any one of these instead of `permission`
   * alone: the Member Portal's pages each need a different one, and a cashier
   * who only decides requests still needs the menu.
   */
  anyOf?: Permission[];
  /**
   * When set, the section shows for anyone who can open one of its pages,
   * each by that page's own gate (`navChildAllowed`), instead of `permission`.
   * Settings holds every module's settings page behind its own key, so its
   * pages decide who sees it, rather than a second list of their keys that a
   * new page could miss.
   */
  opensForItsPages?: boolean;
  /** Its Menu Visibility module (`menu-modules.ts`); Settings has none, as it is always on. */
  module?: MenuModuleKey;
  children?: NavSubItem[];
}

/**
 * The menu without the modules Menu Visibility hides: a hidden section goes
 * with its pages, and a hidden page (a submenu with its own switch, a
 * module's Settings page) goes alone. Permissions are checked afterwards, as
 * before.
 */
export function visibleNav(menu: readonly NavItem[], isHidden: (key: MenuModuleKey) => boolean): NavItem[] {
  return menu
    .filter((item) => !item.module || !isHidden(item.module))
    .map((item) =>
      item.children
        ? { ...item, children: item.children.filter((child) => !child.module || !isHidden(child.module)) }
        : item,
    );
}

/** Whether the menu shows a section: its permission (or one of its pages) and everything it also requires. */
export function navItemAllowed(item: NavItem, can: (permission: Permission) => boolean): boolean {
  const opens = item.opensForItsPages
    ? (item.children ?? []).some((child) => navChildAllowed(child, can))
    : item.anyOf
      ? item.anyOf.some(can)
      : can(item.permission);
  return opens && (item.alsoRequires ?? []).every(can);
}

/** Whether the menu shows a page under a section: its own permission, if any, and everything it also requires. */
export function navChildAllowed(child: NavSubItem, can: (permission: Permission) => boolean): boolean {
  return (!child.permission || meetsPermission(child.permission, can)) && (child.alsoRequires ?? []).every(can);
}

/**
 * Whether a top-level menu link is the current page's: its own path or a page
 * under it, unless another menu link matches the page more closely. On
 * /dashboard/executive only Executive Dashboard is highlighted, not Dashboard.
 */
export function navItemMatches(
  pathname: string,
  href: string,
  menu: readonly { href: string }[] = SIDEBAR_NAV,
): boolean {
  const matches = (h: string) => pathname === h || pathname.startsWith(`${h}/`);
  if (!matches(href)) return false;
  return !menu.some((other) => other.href !== href && other.href.startsWith(`${href}/`) && matches(other.href));
}

/**
 * Where a section's own link goes (the collapsed rail's icon, the command
 * palette). A section that opens on any of several permissions (`anyOf`), or
 * on its pages, goes to the first page the user can open, so a cashier who
 * only decides Member Portal requests lands on the queue, not on a page they
 * can't open.
 */
export function navItemHref(item: NavItem, can: (permission: Permission) => boolean): string {
  if (!item.anyOf && !item.opensForItsPages) return item.href;
  return (item.children ?? []).find((child) => navChildAllowed(child, can))?.href ?? item.href;
}

/**
 * The Member Portal's staff side: who has access, members' requests and
 * announcements. Each page needs its own permission, and the server shows
 * only the caller's branches. Shown only when NEXT_PUBLIC_ENABLE_MEMBER_PORTAL
 * is on. Settings → Member Portal sits under Settings.
 */
export const MEMBER_PORTAL_NAV: NavItem = {
  title: "Member Portal",
  href: "/member-portal",
  icon: MonitorSmartphone,
  module: "member_portal",
  icon3d: "icon-portal",
  permission: "member_portal:view",
  anyOf: ["member_portal:view", "member_portal:requests", "member_portal:announcements"],
  children: [
    { title: "Portal Access", href: "/member-portal", permission: "member_portal:view" },
    { title: "Portal Requests", href: "/member-portal/requests", permission: "member_portal:requests" },
    { title: "Portal Announcements", href: "/member-portal/announcements", permission: "member_portal:announcements" },
  ],
};

/**
 * CDA Compliance. Every page needs `cda:view` and `branches:view_all`; the
 * mediation, audit and tax reports also need their restricted view, and the
 * menu hides them without it. Shown only when NEXT_PUBLIC_ENABLE_CDA is on.
 */
/**
 * Accounting → Interbranch Transfers (Phase 6 MB-BE5), beside Cash & Bank, for
 * `interbranch_transfers:view`. Shown only while NEXT_PUBLIC_ENABLE_MULTI_BRANCH
 * is on; the route answers not found otherwise
 * (accounting/interbranch-transfers/layout.tsx).
 */
export const INTERBRANCH_TRANSFERS_NAV: NavSubItem = {
  title: "Interbranch Transfers",
  href: "/accounting/interbranch-transfers",
  permission: "interbranch_transfers:view",
};

/** Settings → Penalties, for `penalties:view`, shown only while its flag is on. */
export const PENALTIES_SETTINGS_NAV: NavSubItem = {
  title: "Penalties",
  href: "/settings/penalties",
  permission: "penalties:view",
  module: "loans",
};

/**
 * Settings → Linda: the AI model Linda uses. Company-wide, so it also needs
 * `branches:view_all`, as the server does. Shown only when
 * NEXT_PUBLIC_ENABLE_LINDA is set at build time; the route answers not found
 * otherwise (settings/linda/layout.tsx).
 */
export const LINDA_SETTINGS_NAV: NavSubItem = {
  title: "Linda",
  href: "/settings/linda",
  permission: "linda:settings",
  alsoRequires: ["branches:view_all"],
  module: "linda",
};

/**
 * Settings → AMLA: monitoring status, the settings in force and their history,
 * change requests, the working-day calendar and the AMLA log. Each part needs
 * its own AMLA key (most also every branch), so the link shows for any key one
 * part needs, as its page guard does. Shown only when NEXT_PUBLIC_ENABLE_AMLA
 * is set at build time; the route answers not found otherwise
 * (settings/amla/layout.tsx). The AMLA pages themselves (dashboard, alerts,
 * cases, …) come with later Phase 6 slices, each adding its own menu items.
 */
export const AMLA_SETTINGS_NAV: NavSubItem = {
  title: "AMLA",
  href: "/settings/amla",
  permission: [...AMLA_SETTINGS_PAGE_PERMISSIONS],
  module: "amla",
};

/**
 * Each module's own settings, under Settings rather than in the module's menu,
 * so every configuration screen is in one place. Each keeps its module's
 * feature flag and its page's permission; the old module URLs redirect here
 * (next.config.ts).
 */
export const MODULE_SETTINGS_NAV: NavSubItem[] = [
  { title: "Accounting", href: "/settings/accounting", permission: "accounting:settings", module: "accounting" },
  ...(env.features.savings
    ? [
        { title: "Savings Products", href: "/settings/savings-products", permission: "savings:settings" as const, module: "savings" as const },
        { title: "Savings", href: "/settings/savings", permission: "savings:settings" as const, module: "savings" as const },
      ]
    : []),
  ...(env.features.cda
    ? [{ title: "CDA", href: "/settings/cda", permission: "cda:view" as const, alsoRequires: ["branches:view_all" as const], module: "cda" as const }]
    : []),
  ...(env.features.creditScoring
    ? [
        { title: "Scorecard Configuration", href: "/settings/scorecard-configuration", permission: "credit_scoring:settings" as const, module: "credit_scoring" as const },
        { title: "Credit Scoring", href: "/settings/credit-scoring", permission: "credit_scoring:settings" as const, module: "credit_scoring" as const },
      ]
    : []),
  ...(env.features.cic
    ? [{ title: "CIC", href: "/settings/cic", permission: "cic:settings" as const, alsoRequires: ["branches:view_all" as const], module: "cic" as const }]
    : []),
];

/**
 * AMLA Compliance. The /amla pages need `amla:view` (amla/layout.tsx) and each
 * its own key, as its endpoints do: Alerts `amla:alerts`, CTR Candidates
 * `amla:ctr`, Customers `amla:cdd`; Transaction Monitoring and Risk Rules are
 * head office only. Compliance Cases needs `amla:cases`, the STR and CTR pages
 * their reading keys, Regulatory Submissions any reporting key and Audit &
 * Compliance History `amla:audit`; cases, STRs and the history are head
 * office only. The section
 * also carries an "AMLA Settings" link, opening as Settings → AMLA does, so a
 * Compliance Officer (who holds no `settings:view`) has a menu path to it.
 * Later Phase 6 slices add their pages here. Shown only when
 * NEXT_PUBLIC_ENABLE_AMLA is set at build time.
 */
export const AMLA_NAV: NavItem = {
  title: "AMLA Compliance",
  href: "/amla",
  icon: ShieldAlert,
  module: "amla",
  permission: "amla:view",
  anyOf: [...AMLA_SETTINGS_PAGE_PERMISSIONS],
  children: [
    { title: "AMLA Dashboard", href: "/amla", permission: "amla:view" },
    { title: "Alerts", href: "/amla/alerts", permission: "amla:alerts", alsoRequires: ["amla:view"] },
    { title: "CTR Candidates", href: "/amla/ctr-candidates", permission: "amla:ctr", alsoRequires: ["amla:view"] },
    // The rules in force, and how detection runs: head office only, as its endpoint is.
    { title: "Transaction Monitoring", href: "/amla/monitoring", permission: "amla:view", alsoRequires: ["branches:view_all"] },
    { title: "Customers", href: "/amla/customers", permission: "amla:cdd", alsoRequires: ["amla:view"] },
    // Screening and the orders register cover the whole cooperative, as their endpoints do.
    { title: "Screening", href: "/amla/screening", permission: "amla:screening", alsoRequires: ["amla:view", "branches:view_all"] },
    { title: "Orders Register", href: "/amla/orders", permission: "amla:sanctions", alsoRequires: ["amla:view", "branches:view_all"] },
    {
      title: "Risk Rules",
      href: "/amla/risk-rules",
      permission: [...AMLA_RISK_RULES_PERMISSIONS],
      alsoRequires: ["amla:view", "branches:view_all"],
    },
    // Cases and filings, each gated as its routes are: cases and STRs are head office's.
    { title: "Compliance Cases", href: "/amla/cases", permission: "amla:cases", alsoRequires: ["amla:view", "branches:view_all"] },
    {
      title: "Suspicious Transactions (STR)",
      href: "/amla/str",
      permission: [...AMLA_STR_READ],
      alsoRequires: ["amla:view", "branches:view_all"],
    },
    { title: "Covered Transactions (CTR)", href: "/amla/ctr", permission: [...AMLA_CTR_READ], alsoRequires: ["amla:view"] },
    { title: "Regulatory Submissions", href: "/amla/submissions", permission: [...AMLA_REPORT_READ], alsoRequires: ["amla:view"] },
    // The server lists only the reports the caller may open (each needs its own key).
    { title: "AMLA Reports", href: "/amla/reports", permission: "amla:view" },
    { title: "Audit & Compliance History", href: "/amla/history", permission: "amla:audit", alsoRequires: ["amla:view", "branches:view_all"] },
    { ...AMLA_SETTINGS_NAV, title: "AMLA Settings" },
  ],
};

export const CDA_NAV: NavItem = {
  title: "CDA Compliance",
  href: "/cda",
  icon: ClipboardCheck,
  module: "cda",
  icon3d: "empty-compliance",
  permission: "cda:view",
  alsoRequires: MODULE_ALSO_REQUIRES.cda as Permission[],
  children: [
    { title: "CDA Dashboard", href: "/cda" },
    { title: "Compliance Calendar", href: "/cda/calendar" },
    { title: "CAPR", href: "/cda/capr" },
    { title: "Financial Statements", href: "/cda/financial-statements", permission: "cda:view_audit" },
    { title: "Performance Audit", href: "/cda/performance-audit", permission: "cda:view_audit" },
    { title: "Social Audit", href: "/cda/social-audit" },
    { title: "Enhanced PESOS", href: "/cda/pesos" },
    { title: "Loan Classification", href: "/cda/loan-classification" },
    { title: "Officers & Trainings", href: "/cda/officers" },
    { title: "Mediation & Conciliation", href: "/cda/mediation", permission: "cda:view_mediation" },
    { title: "Sworn Statement", href: "/cda/sworn-statement" },
    { title: "ATIR & ABR", href: "/cda/tax-reports", permission: "cda:view_tax" },
    { title: "Compliance Documents", href: "/cda/documents" },
    { title: "Submission History", href: "/cda/submissions" },
  ],
};

const CREDIT_SCORING_NAV: NavItem = {
  title: "Credit Scoring",
  href: "/credit-scoring",
  icon: Gauge,
  module: "credit_scoring",
  icon3d: "icon-credit-score",
  permission: "credit_scoring:view",
  /**
   * The backend seeds `credit_scoring:view|override|settings` for admin and
   * super_admin only (lendyph-backend #174, 2026-10-02), and every endpoint
   * behind these five destinations answers 501 until it is built. Each
   * screen then shows its "Not connected yet" panel: `useApiResource` treats
   * 404 and 501 as "not built yet" and anything else as an error, so a real
   * endpoint must not ship as a 403/500 stub.
   *
   * The server's permissions are the only gate. `RouteGuard` reads the same
   * `user.permissions` from the auth store as the sidebar, so granting
   * `credit_scoring:view` to another role shows it this menu at once.
   *
   * Note the name: the settings key is `credit_scoring:settings`, NOT
   * `:configure`. The design spec originally said `configure` and has
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
    { title: "Member Scores", href: "/credit-scoring/borrowers", permission: "credit_scoring:view" },
    { title: "Credit Assessment", href: "/credit-scoring/assessment", permission: "credit_scoring:view" },
    { title: "Risk Monitoring", href: "/credit-scoring/risk-monitoring", permission: "credit_scoring:view" },
    { title: "Score History", href: "/credit-scoring/score-history", permission: "credit_scoring:view" },
  ],
};

/**
 * CIC reporting (Phase 10): the monthly Credit Submission Data File for the
 * Credit Information Corporation. Gated on NEXT_PUBLIC_ENABLE_CIC; the routes
 * also answer not found with the flag off (cic/layout.tsx).
 *
 * The file covers the whole cooperative, so the menu also needs every branch
 * (`branches:view_all`), as each page does (CicGuard) and every `/cic` API.
 * The backend seeds `cic:view|prepare|submit|review|settings` for admin and
 * super_admin. Menu Visibility hides the menu, its pages and Settings → CIC
 * under the `cic` key (menu-modules.ts), and the server then answers 404 on
 * every `/cic` route.
 */
export const CIC_NAV: NavItem = {
  title: "CIC Reporting",
  href: "/cic",
  icon: FileUp,
  icon3d: "empty-compliance",
  module: "cic",
  permission: "cic:view",
  alsoRequires: MODULE_ALSO_REQUIRES.cic as Permission[],
  children: [
    { title: "Data Readiness", href: "/cic", permission: "cic:view" },
    { title: "Subject Records", href: "/cic/subjects", permission: "cic:view" },
    { title: "Contract Records", href: "/cic/contracts", permission: "cic:view" },
    { title: "Issues", href: "/cic/issues", permission: "cic:view" },
    { title: "Generate Report", href: "/cic/generate", permission: "cic:prepare" },
    { title: "Corrections", href: "/cic/corrections", permission: "cic:view" },
    { title: "Submission History", href: "/cic/submissions", permission: "cic:view" },
  ],
};

/**
 * Linda's own page: the same conversation as the floating button's panel, on
 * a full page. Gated on NEXT_PUBLIC_ENABLE_LINDA at build time; the route also
 * answers not found when the flag is off (linda/layout.tsx), and the page
 * guards on `linda:use`, as the server does.
 */
export const LINDA_NAV: NavItem = {
  title: "Linda",
  href: "/linda",
  icon: Sparkles,
  module: "linda",
  permission: "linda:use",
};

/**
 * The Executive Dashboard, right below Dashboard. Shown only with
 * NEXT_PUBLIC_ENABLE_EXECUTIVE_DASHBOARD on and to holders of
 * `dashboard:analytics`, the same gate as its page (dashboard/executive/layout.tsx).
 */
export const EXECUTIVE_DASHBOARD_NAV: NavItem = {
  title: "Executive Dashboard",
  href: "/dashboard/executive",
  icon: TrendingUp,
  module: "executive_dashboard",
  icon3d: "icon-trend",
  permission: EXECUTIVE_DASHBOARD_PERMISSION,
};

export const SIDEBAR_NAV: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    module: "dashboard",
    icon: LayoutDashboard,
    icon3d: "icon-dashboard",
    permission: "dashboard:view",
  },
  ...(env.features.executiveDashboard ? [EXECUTIVE_DASHBOARD_NAV] : []),
  ...(env.features.linda ? [LINDA_NAV] : []),
  {
    title: "Members",
    href: "/borrowers",
    module: "members",
    icon: Users,
    icon3d: "empty-members",
    permission: "borrowers:view",
    children: [
      { title: "All Members", href: "/borrowers" },
      { title: "New Member", href: "/borrowers/new", permission: "borrowers:create" },
    ],
  },
  {
    title: "Loans",
    href: "/loans",
    module: "loans",
    icon: FileText,
    icon3d: "empty-loans",
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
      // Shown with `reminders:view`, which the server grants to admin and
      // super_admin (other roles only through the roles screen). The six
      // reminder screens are tabs inside /loans/reminders, not menu items.
      { title: "Reminders", href: "/loans/reminders", permission: "reminders:view", module: "loans.reminders" },
      // NEXT_PUBLIC_ENABLE_LOAN_ORIGINATION only. Its six screens are tabs
      // inside /loans/origination, not menu items.
      ...(env.features.loanOrigination
        ? [{ title: "Loan Origination", href: "/loans/origination", permission: "loan_origination:view" as const, module: "loans.origination" as const }]
        : []),
    ],
  },
  {
    title: "Payments",
    href: "/payments",
    module: "payments",
    icon: CreditCard,
    icon3d: "empty-payments",
    permission: "payments:view",
    children: [
      { title: "New Payment", href: "/payments" },
      { title: "Payment History", href: "/payments/history" },
      { title: "Auto-Pay", href: "/payments/auto-pay", permission: "auto_pay:view", module: "payments.auto_pay" },
    ],
  },
  {
    title: "Share Capital",
    href: "/share-capital",
    module: "share_capital",
    icon: Landmark,
    icon3d: "empty-share-capital",
    permission: "share_capital:view",
    children: [
      { title: "Subsidiary Ledger", href: "/share-capital/ledger" },
      { title: "Pledge Entry", href: "/share-capital/pledges" },
      { title: "Auto-Credit", href: "/share-capital/auto-credit", permission: "share_capital:create", module: "share_capital.auto_credit" },
    ],
  },
  // Savings & Deposits: hidden unless NEXT_PUBLIC_ENABLE_SAVINGS is on (staging
  // only); the backend seeds `savings:*` for admin and super_admin.
  ...(env.features.savings
    ? [
        {
          title: "Savings",
          href: "/savings",
          icon: PiggyBank,
          module: "savings" as const,
          icon3d: "empty-savings" as const,
          permission: "savings:view" as const,
          children: [
            { title: "Dashboard", href: "/savings/dashboard" },
            { title: "Savings Accounts", href: "/savings" },
            { title: "Time Deposits", href: "/savings/time-deposits" },
            { title: "Savings Transactions", href: "/savings/transactions" },
            { title: "Savings Approvals", href: "/savings/approvals" },
            { title: "Savings Interest", href: "/savings/interest" },
            { title: "Savings Auto-Credit", href: "/savings/auto-credit" },
            { title: "Dormant Accounts", href: "/savings/dormant", permission: "reports:view" as const },
          ],
        },
      ]
    : []),
  {
    title: "Collateral",
    href: "/collaterals",
    module: "collateral",
    icon: ShieldCheck,
    icon3d: "empty-collaterals",
    permission: "collaterals:view",
    children: [
      { title: "Collateral Listing", href: "/collaterals" },
      { title: "Collateral Entry", href: "/collaterals/new", permission: "collaterals:create" },
    ],
  },
  {
    title: "GCash",
    href: "/gcash",
    module: "gcash",
    icon: GCashIcon,
    permission: "gcash:view",
  },
  // Gated on NEXT_PUBLIC_ENABLE_CREDIT_SCORING at build time. The routes also
  // answer not found when the flag is off (credit-scoring/layout.tsx).
  ...(env.features.creditScoring ? [CREDIT_SCORING_NAV] : []),
  // Gated on NEXT_PUBLIC_ENABLE_CIC; cic/layout.tsx answers not found too.
  ...(env.features.cic ? [CIC_NAV] : []),
  ...(env.features.cda ? [CDA_NAV] : []),
  ...(env.features.memberPortal ? [MEMBER_PORTAL_NAV] : []),
  ...(env.features.amla ? [AMLA_NAV] : []),
  {
    title: "Accounting",
    href: "/accounting",
    module: "accounting",
    icon: BookOpenCheck,
    icon3d: "empty-ledger",
    permission: "accounting:view",
    /**
     * Fifteen children, which is the most any menu here has. Two of them —
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
      ...(env.features.multiBranch ? [INTERBRANCH_TRANSFERS_NAV] : []),
      { title: "Expenses & Payables", href: "/accounting/expenses", permission: "expenses:view" },
      { title: "Loan Accounting", href: "/accounting/loans" },
      { title: "General Ledger", href: "/accounting/general-ledger" },
      { title: "Trial Balance", href: "/accounting/trial-balance" },
      { title: "Reconciliation", href: "/accounting/reconciliation", permission: "accounting:reconcile" },
      { title: "Financial Statements", href: "/accounting/statements" },
      { title: "Accounting Books", href: "/accounting/books" },
      { title: "Period Closing", href: "/accounting/period-closing", permission: "accounting:close" },
      // The page itself opens on `accounting:view` (+ `branches:view_all`);
      // the menu shows it to those who set the entry up.
      { title: "Opening Balances", href: "/accounting/opening-balances", permission: "accounting:settings" },
      { title: "Allowance for Credit Losses", href: "/accounting/allowance", permission: "accounting:view" },
    ],
  },
  {
    title: "User Management",
    href: "/users",
    module: "users",
    icon: UserCog,
    icon3d: "icon-users",
    permission: "users:view",
  },
  {
    title: "Reports",
    href: "/reports",
    module: "reports",
    icon: BarChart3,
    icon3d: "pick-report",
    permission: "reports:view",
  },
  {
    title: "Documents",
    href: "/printables",
    module: "documents",
    icon: FileStack,
    icon3d: "empty-documents",
    // Same gate as Reports: both read the whole book — every loan, member and
    // payment — so they stand or fall on the same permission.
    permission: "reports:view",
  },
  {
    title: "Audit Trail",
    href: "/audit-trail",
    module: "audit_trail",
    icon: History,
    icon3d: "icon-audit",
    permission: "audit_logs:view",
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    icon3d: "icon-settings",
    permission: "settings:view",
    /**
     * Every module's settings live here, each behind its own permission, so
     * the section opens for anyone who can open one of its pages: an
     * accountant with only `accounting:settings`, a role that runs imports
     * with only `imports:process`. Children therefore name their permission:
     * one left blank would be offered to everyone the section shows for.
     */
    opensForItsPages: true,
    children: [
      { title: "Profile", href: "/settings/profile", permission: "settings:view" },
      { title: "Branding", href: "/settings/branding", permission: "settings:view" },
      { title: "Branches", href: "/settings/branches", permission: "settings:view" },
      { title: "Loan Products", href: "/settings/loan-products", permission: "settings:view", module: "loans" },
      { title: "Fees", href: "/settings/fees", permission: "fees:view", module: "loans" },
      // Gated on NEXT_PUBLIC_ENABLE_PENALTY_CONFIGS at build time; the route
      // answers not found when it is off (settings/penalties/layout.tsx).
      ...(env.features.penaltyConfigs ? [PENALTIES_SETTINGS_NAV] : []),
      { title: "Collateral Types", href: "/settings/collateral-types", permission: "settings:view", module: "collateral" },
      { title: "Role and Permissions", href: "/settings/user-roles", permission: "settings:view" },
      { title: "Approval Workflow", href: "/settings/approval-workflow", permission: "settings:view" },
      { title: "GCash", href: "/settings/gcash", permission: "settings:view", module: "gcash" },
      ...MODULE_SETTINGS_NAV,
      // Company-wide, so it also needs branches:view_all, as the server does.
      ...(env.features.memberPortal
        ? [
            {
              title: "Member Portal",
              href: "/settings/member-portal",
              permission: "member_portal:settings" as const,
              alsoRequires: ["branches:view_all" as const],
              module: "member_portal" as const,
            },
          ]
        : []),
      ...(env.features.linda ? [LINDA_SETTINGS_NAV] : []),
      ...(env.features.amla ? [AMLA_SETTINGS_NAV] : []),
      // Which menus this deployment shows (Menu Visibility); the page also asks
      // for the administrator password, which the server checks.
      { title: "Menu Visibility", href: "/settings/menu-visibility", permission: "menu_visibility:manage" },
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
