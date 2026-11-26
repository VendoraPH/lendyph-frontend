/**
 * The parts of a hidden module that show on another module's screen, each
 * gated on its own module's key (finish run round 6, Menu Visibility).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { moduleHidden } from "@/constants/menu-modules";
import {
  accountingDashboardParts,
  accountingStatementsParts,
  approvalWorkflowParts,
  catalogEntryShown,
  dashboardParts,
  dataImportParts,
  executiveDashboardParts,
  loanListParts,
  loanPageParts,
  memberPageParts,
  linkShown,
  pledgeEntryParts,
} from "./hidden-module-parts";

const hiding = (...keys: string[]) => {
  const set = new Set(keys);
  return (key: string) => moduleHidden(key, set);
};
const none = hiding();

test("member page: the Savings tab, the portal access card and share control, the reminder preferences", () => {
  assert.deepEqual(memberPageParts(none), {
    savingsTab: true,
    portalAccess: true,
    reminderPreferences: true,
    shareCapitalTab: true,
  });
  assert.equal(memberPageParts(hiding("share_capital")).shareCapitalTab, false);
  assert.equal(memberPageParts(hiding("savings")).savingsTab, false);
  assert.equal(memberPageParts(hiding("member_portal")).portalAccess, false);
  assert.equal(memberPageParts(hiding("loans.reminders")).reminderPreferences, false);
  // A hidden parent hides its submenu's parts too.
  assert.equal(memberPageParts(hiding("loans")).reminderPreferences, false);
  assert.deepEqual(memberPageParts(hiding("payments", "gcash")), memberPageParts(none));
});

test("loan page: the credit scoring card, the reminders card and Auto-Pay", () => {
  assert.deepEqual(loanPageParts(none), { creditAssessment: true, reminders: true, autoPay: true });
  assert.equal(loanPageParts(hiding("credit_scoring")).creditAssessment, false);
  assert.equal(loanPageParts(hiding("loans.reminders")).reminders, false);
  assert.equal(loanPageParts(hiding("payments.auto_pay")).autoPay, false);
  assert.equal(loanPageParts(hiding("payments")).autoPay, false);
});

test("loan list: the Auto-Pay column", () => {
  assert.equal(loanListParts(none).autoPay, true);
  assert.equal(loanListParts(hiding("payments.auto_pay")).autoPay, false);
});

test("Pledge Entry: the Auto-Credit switch, stat, filter and column go, and the manual-entry lock stays", () => {
  assert.deepEqual(pledgeEntryParts(none), { autoCredit: true, manualEntryLockedByAutoCredit: true });
  // Hiding never changes how money moves: a pledge set to auto-credit still
  // takes no manual entry, or the next run could credit a month twice.
  assert.deepEqual(pledgeEntryParts(hiding("share_capital.auto_credit")), {
    autoCredit: false,
    manualEntryLockedByAutoCredit: true,
  });
});

test("Executive Dashboard: Share Capital Control, and the Dashboard link", () => {
  assert.deepEqual(executiveDashboardParts(none), { shareCapitalControl: true, shareCapitalFigures: true, dashboardLink: true });
  assert.equal(executiveDashboardParts(hiding("share_capital")).shareCapitalControl, false);
  // The overview's Share Capital card and Financial Performance's figure.
  assert.equal(executiveDashboardParts(hiding("share_capital")).shareCapitalFigures, false);
  assert.equal(executiveDashboardParts(hiding("dashboard")).dashboardLink, false);
});

test("Data Import: the share capital file", () => {
  assert.equal(dataImportParts(none).shareCapitalFile, true);
  assert.equal(dataImportParts(hiding("share_capital")).shareCapitalFile, false);
});

test("Approval Workflow: the CDA review chain", () => {
  assert.equal(approvalWorkflowParts(none).cdaChain, true);
  assert.equal(approvalWorkflowParts(hiding("cda")).cdaChain, false);
});

test("Accounting dashboard: the savings banner", () => {
  assert.equal(accountingDashboardParts(none).savingsBanner, true);
  assert.equal(accountingDashboardParts(hiding("savings")).savingsBanner, false);
});

test("main dashboard: the share capital card", () => {
  assert.equal(dashboardParts(none).shareCapital, true);
  assert.equal(dashboardParts(hiding("share_capital")).shareCapital, false);
});

test("a catalog entry shows unless any module it reads is hidden", () => {
  assert.equal(catalogEntryShown(undefined, hiding("savings")), true);
  assert.equal(catalogEntryShown(["savings"], none), true);
  assert.equal(catalogEntryShown(["savings"], hiding("savings")), false);
  assert.equal(catalogEntryShown(["share_capital", "accounting"], hiding("accounting")), false);
});

test("an in-app link is shown unless it leads into a hidden module or a hidden menu's report", () => {
  assert.equal(linkShown("/accounting", hiding("accounting")), false);
  assert.equal(linkShown("/accounting/journals?x=1", hiding("accounting")), false);
  assert.equal(linkShown("/reports/share_capital", hiding("share_capital")), false);
  assert.equal(linkShown("/reports/savings_summary", hiding("savings")), false);
  assert.equal(linkShown("/reports/profit_sharing", hiding("accounting")), false);
  assert.equal(linkShown("/reports/cash_flow", hiding("accounting", "savings")), true);
  assert.equal(linkShown("/loans/12", hiding("savings")), true);
  assert.equal(linkShown("/reports/cash_flow", hiding("reports")), false);
});

test("Accounting statements: the Notes tab, which quotes CDA's PESOS rating", () => {
  assert.equal(accountingStatementsParts(none).pesosNotes, true);
  assert.equal(accountingStatementsParts(hiding("cda")).pesosNotes, false);
});
