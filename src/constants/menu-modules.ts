import { env } from "@/config/env";

/**
 * Menu Visibility (finish run round 6, ClickUp 14zfbg0e9jq): the side menu's
 * modules an administrator can switch off, keyed as the server keys them
 * (`menu-visibility-contract.md`), in the side menu's order. Settings isn't
 * one: it is always on.
 *
 * Each module lists the page paths it owns: its own pages and its pages under
 * Settings. A path belongs to the module with the longest matching prefix,
 * matched by whole segments, so `/loans/reminders` is Reminders while
 * `/loans/remindersx` would be Loans. A hidden module's paths read not found.
 */
export type MenuModuleKey =
  | "dashboard"
  | "executive_dashboard"
  | "linda"
  | "members"
  | "loans"
  | "loans.reminders"
  | "loans.origination"
  | "payments"
  | "payments.auto_pay"
  | "share_capital"
  | "share_capital.auto_credit"
  | "savings"
  | "collateral"
  | "gcash"
  | "credit_scoring"
  | "cda"
  | "member_portal"
  | "amla"
  | "accounting"
  | "users"
  | "reports"
  | "documents"
  | "audit_trail";

export interface MenuModule {
  key: MenuModuleKey;
  label: string;
  parent: MenuModuleKey | null;
  /** Whether this deployment's build has the module (its feature flag in `env.features`). */
  inBuild: boolean;
  /** The page paths it owns, its Settings pages included. */
  paths: readonly string[];
}

export const MENU_MODULES: readonly MenuModule[] = [
  { key: "dashboard", label: "Dashboard", parent: null, inBuild: true, paths: ["/dashboard"] },
  {
    key: "executive_dashboard",
    label: "Executive Dashboard",
    parent: null,
    inBuild: env.features.executiveDashboard,
    paths: ["/dashboard/executive"],
  },
  { key: "linda", label: "Linda", parent: null, inBuild: env.features.linda, paths: ["/linda", "/settings/linda"] },
  { key: "members", label: "Members", parent: null, inBuild: true, paths: ["/borrowers"] },
  {
    key: "loans",
    label: "Loans",
    parent: null,
    inBuild: true,
    // Loan products, their fees and penalty configurations are the loans' own settings.
    paths: ["/loans", "/settings/loan-products", "/settings/fees", "/settings/penalties"],
  },
  { key: "loans.reminders", label: "Reminders", parent: "loans", inBuild: true, paths: ["/loans/reminders"] },
  {
    key: "loans.origination",
    label: "Loan Origination",
    parent: "loans",
    inBuild: env.features.loanOrigination,
    paths: ["/loans/origination"],
  },
  { key: "payments", label: "Payments", parent: null, inBuild: true, paths: ["/payments"] },
  { key: "payments.auto_pay", label: "Auto-Pay", parent: "payments", inBuild: true, paths: ["/payments/auto-pay"] },
  { key: "share_capital", label: "Share Capital", parent: null, inBuild: true, paths: ["/share-capital"] },
  {
    key: "share_capital.auto_credit",
    label: "Auto-Credit",
    parent: "share_capital",
    inBuild: true,
    paths: ["/share-capital/auto-credit"],
  },
  {
    key: "savings",
    label: "Savings",
    parent: null,
    inBuild: env.features.savings,
    paths: ["/savings", "/settings/savings", "/settings/savings-products"],
  },
  { key: "collateral", label: "Collateral", parent: null, inBuild: true, paths: ["/collaterals", "/settings/collateral-types"] },
  { key: "gcash", label: "GCash", parent: null, inBuild: true, paths: ["/gcash", "/settings/gcash"] },
  {
    key: "credit_scoring",
    label: "Credit Scoring",
    parent: null,
    inBuild: env.features.creditScoring,
    paths: ["/credit-scoring", "/settings/credit-scoring", "/settings/scorecard-configuration"],
  },
  { key: "cda", label: "CDA Compliance", parent: null, inBuild: env.features.cda, paths: ["/cda", "/settings/cda"] },
  {
    key: "member_portal",
    label: "Member Portal",
    parent: null,
    inBuild: env.features.memberPortal,
    paths: ["/member-portal", "/settings/member-portal"],
  },
  { key: "amla", label: "AMLA Compliance", parent: null, inBuild: env.features.amla, paths: ["/amla", "/settings/amla"] },
  { key: "accounting", label: "Accounting", parent: null, inBuild: true, paths: ["/accounting", "/settings/accounting"] },
  { key: "users", label: "User Management", parent: null, inBuild: true, paths: ["/users"] },
  { key: "reports", label: "Reports", parent: null, inBuild: true, paths: ["/reports"] },
  { key: "documents", label: "Documents", parent: null, inBuild: true, paths: ["/printables"] },
  { key: "audit_trail", label: "Audit Trail", parent: null, inBuild: true, paths: ["/audit-trail"] },
];

const BY_KEY: ReadonlyMap<string, MenuModule> = new Map(MENU_MODULES.map((m) => [m.key, m]));

/** The module with this key, if the build knows it. */
export function menuModule(key: string): MenuModule | undefined {
  return BY_KEY.get(key);
}

/** Whether `pathname` is `prefix` or a page under it, by whole segments. */
function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * The module a page belongs to: the one whose path is the longest whole-segment
 * prefix of `pathname`. Null for pages no module owns (Settings' own pages,
 * Menu Visibility itself), which are never hidden.
 */
export function moduleForPath(pathname: string, modules: readonly MenuModule[] = MENU_MODULES): MenuModuleKey | null {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  let best: { key: MenuModuleKey; length: number } | null = null;
  for (const mod of modules) {
    for (const prefix of mod.paths) {
      if (underPrefix(path, prefix) && (best === null || prefix.length > best.length)) {
        best = { key: mod.key, length: prefix.length };
      }
    }
  }
  return best?.key ?? null;
}

/**
 * Whether a module is hidden, given the server's hidden keys: it, or its
 * parent, is in the list. The server already sends a hidden parent's children;
 * this holds even if it didn't.
 */
export function moduleHidden(key: string | null | undefined, hidden: ReadonlySet<string>): boolean {
  if (!key) return false;
  if (hidden.has(key)) return true;
  const parent = BY_KEY.get(key)?.parent;
  return parent ? hidden.has(parent) : false;
}
