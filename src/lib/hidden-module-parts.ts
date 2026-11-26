import { moduleForPath, type MenuModuleKey } from "@/constants/menu-modules";

/**
 * Menu Visibility (finish run round 6): the parts of a module that show on
 * another module's screen, each gated on its own module's key, so hiding a
 * menu also removes its card, tab, switch or catalog entry elsewhere, and none
 * of them asks the server (which answers 404 for a hidden module's API).
 *
 * `isHidden` is `useMenuVisibility().isHidden`: a module is hidden when it,
 * or its parent, is. The app shell renders pages only after the first answer,
 * so none of these parts can flash.
 */
type IsHidden = (key: MenuModuleKey) => boolean;

/** The member page: the Savings tab, the portal access card and "Share with member", the reminder preferences. */
export function memberPageParts(isHidden: IsHidden) {
  return {
    savingsTab: !isHidden("savings"),
    portalAccess: !isHidden("member_portal"),
    reminderPreferences: !isHidden("loans.reminders"),
  };
}

/** The loan page: the credit scoring card, the reminders card, and the Auto-Pay card and post-release prompt. */
export function loanPageParts(isHidden: IsHidden) {
  return {
    creditAssessment: !isHidden("credit_scoring"),
    reminders: !isHidden("loans.reminders"),
    autoPay: !isHidden("payments.auto_pay"),
  };
}

/** The Loans list: its Auto-Pay column. */
export function loanListParts(isHidden: IsHidden) {
  return { autoPay: !isHidden("payments.auto_pay") };
}

/** Pledge Entry: the Auto-Credit switch, its stat and its filter. */
export function pledgeEntryParts(isHidden: IsHidden) {
  return { autoCredit: !isHidden("share_capital.auto_credit") };
}

/** Settings → Approval Workflow: the CDA review chain. */
export function approvalWorkflowParts(isHidden: IsHidden) {
  return { cdaChain: !isHidden("cda") };
}

/** The Accounting dashboard: the savings books banner. */
export function accountingDashboardParts(isHidden: IsHidden) {
  return { savingsBanner: !isHidden("savings") };
}

/** Accounting → Financial Statements: the Notes tab, which quotes CDA's Enhanced PESOS rating. */
export function accountingStatementsParts(isHidden: IsHidden) {
  return { pesosNotes: !isHidden("cda") };
}

/** The main dashboard: the Share Capital card (GET /share-capital/members). */
export function dashboardParts(isHidden: IsHidden) {
  return { shareCapital: !isHidden("share_capital") };
}

/** A Reports or Documents catalog entry shows unless a module it reads is hidden. */
export function catalogEntryShown(modules: readonly MenuModuleKey[] | undefined, isHidden: IsHidden): boolean {
  return !(modules ?? []).some(isHidden);
}

/**
 * The menus a report reads besides Reports, by its id (the catalog's
 * `modules` says the same; a test keeps them equal): Savings reports, the
 * Share Capital report, and Profit Sharing (share capital and the books).
 */
export function reportModules(id: string): MenuModuleKey[] {
  if (id.startsWith("savings_") || id === "time_deposit_maturities") return ["savings"];
  if (id === "share_capital") return ["share_capital"];
  if (id === "profit_sharing") return ["share_capital", "accounting"];
  return [];
}

/**
 * Whether an in-app link still leads somewhere: not into a hidden module's
 * pages, and not to a report of a hidden menu. A card or notification whose
 * link is hidden stays, unlinked.
 */
export function linkShown(href: string, isHidden: IsHidden): boolean {
  const path = href.split(/[?#]/)[0];
  const owner = moduleForPath(path);
  if (owner !== null && isHidden(owner)) return false;
  const report = /^\/reports\/([^/]+)$/.exec(path);
  return !(report && reportModules(report[1]).some(isHidden));
}
