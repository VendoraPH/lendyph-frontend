/**
 * Each screen that shows a part of another module asks that module's gate
 * (`hidden-module-parts.ts`), and the Reports and Documents catalogs leave out
 * hidden modules' entries (finish run round 6, Menu Visibility).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { moduleHidden } from "@/constants/menu-modules";
import { REPORT_CATALOG, reportAccess, visibleAmlaReports, visibleReports } from "@/app/(app)/reports/_lib/report-catalog";
import { PRINTABLE_CATALOG, visiblePrintables } from "@/lib/printables/catalog";
import { reportModules } from "./hidden-module-parts";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const hiding = (...keys: string[]) => {
  const set = new Set(keys);
  return (key: string) => moduleHidden(key, set);
};
const everyone = () => true;

test("each screen asks its parts' gate", () => {
  const uses: [string, RegExp][] = [
    ["src/app/(app)/borrowers/[id]/page.tsx", /memberPageParts\(isHidden\)/],
    ["src/app/(app)/borrowers/[id]/_components/overview-tab.tsx", /memberPageParts\(isHidden\)/],
    ["src/app/(app)/borrowers/[id]/_components/documents-tab.tsx", /memberPageParts\(isHidden\)\.portalAccess/],
    ["src/app/(app)/loans/[id]/page.tsx", /loanPageParts\(isHidden\)/],
    ["src/app/(app)/loans/page.tsx", /loanListParts\(isHidden\)/],
    ["src/app/(app)/share-capital/pledges/page.tsx", /pledgeEntryParts\(isHidden\)/],
    ["src/app/(app)/settings/approval-workflow/page.tsx", /approvalWorkflowParts\(isHidden\)/],
    ["src/app/(app)/accounting/page.tsx", /accountingDashboardParts\(isHidden\)/],
    ["src/app/(app)/accounting/statements/page.tsx", /accountingStatementsParts\(isHidden\)\.pesosNotes/],
    ["src/app/(app)/dashboard/page.tsx", /dashboardParts\(isHidden\)/],
    ["src/app/(app)/reports/page.tsx", /visibleReports\(hasPermission, isHidden\)/],
    ["src/app/(app)/reports/page.tsx", /visibleAmlaReports\(hasPermission, isHidden\)/],
    ["src/app/(app)/reports/[reportId]/page.tsx", /reportAccess\(reportId \?\? "", hasPermission, isHidden\)/],
    ["src/app/(app)/printables/page.tsx", /visiblePrintables\(can, isHidden\)/],
    ["src/app/(app)/printables/[printableId]/page.tsx", /visiblePrintables\(can, isHidden\)/],
  ];
  for (const [file, pattern] of uses) assert.match(read(file), pattern, file);
});

test("the loan list's Auto-Pay column can be left out", () => {
  const table = read("src/app/(app)/loans/_components/loan-table.tsx");
  assert.match(table, /onAutoPayClick\?: \(loan: Loan\) => void;/);
});

test("Reports leaves out the savings, share capital and books reports while their menu is hidden", () => {
  const ids = (isHidden: (key: string) => boolean) => visibleReports(everyone, isHidden).map((r) => r.id);
  const all = ids(hiding());
  const savings = REPORT_CATALOG.filter((r) => r.modules?.includes("savings")).map((r) => r.id);
  assert.ok(savings.length > 0);
  for (const id of savings) assert.equal(ids(hiding("savings")).includes(id), false, id);
  assert.equal(ids(hiding("share_capital")).includes("share_capital"), false);
  assert.equal(ids(hiding("accounting")).includes("profit_sharing"), false);
  assert.ok(all.includes("daily_collection"));
  assert.deepEqual(ids(hiding("gcash", "cda", "credit_scoring")), all);
  assert.equal(reportAccess("share_capital", everyone, hiding("share_capital")), "not_found");
  assert.equal(reportAccess("share_capital", everyone, hiding()), "open");
});

test("Reports leaves out the AMLA reports while AMLA is hidden", () => {
  assert.deepEqual(visibleAmlaReports(everyone, hiding("amla")), []);
});

test("Documents leaves out the savings documents and the share capital certificate while their menu is hidden", () => {
  const ids = (isHidden: (key: string) => boolean) => visiblePrintables(everyone, isHidden).map((p) => p.id);
  const savingsDocs = PRINTABLE_CATALOG.filter((p) => p.modules?.includes("savings")).map((p) => p.id);
  assert.ok(savingsDocs.length > 0);
  for (const id of savingsDocs) assert.equal(ids(hiding("savings")).includes(id), false, id);
  assert.equal(ids(hiding("share_capital")).includes("share_capital_certificate"), false);
  assert.ok(ids(hiding("savings")).includes("promissory_note"));
});

test("each report's modules in the catalog are the ones its id names", () => {
  for (const report of REPORT_CATALOG) assert.deepEqual([...(report.modules ?? [])], reportModules(report.id), report.id);
});

test("links on the dashboards and in the bell skip hidden pages", () => {
  assert.match(read("src/app/(app)/dashboard/page.tsx"), /linkShown\(kpi\.href, isHidden\)/);
  assert.match(read("src/app/(app)/dashboard/executive/_components/kpi-card.tsx"), /linkShown\(card\.href, isHidden\)/);
  assert.match(read("src/components/layout/notification-bell.tsx"), /linkShown\(item\.href, isHidden\)/);
});
