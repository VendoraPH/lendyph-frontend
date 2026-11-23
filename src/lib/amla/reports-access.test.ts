/**
 * The AMLA reports on the Reports page with NEXT_PUBLIC_ENABLE_AMLA on. The
 * flag is read when `@/config/env` loads, so it is set before the catalog is
 * imported; each test file runs in its own process. The flag-off case is in
 * report-catalog.test.ts.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import type { Permission } from "@/types";

let catalog: typeof import("@/app/(app)/reports/_lib/report-catalog");
let access: typeof import("./reports-access");

before(async () => {
  process.env.NEXT_PUBLIC_ENABLE_AMLA = "true";
  catalog = await import("@/app/(app)/reports/_lib/report-catalog");
  access = await import("./reports-access");
});

const holds = (...held: string[]) => (p: Permission) => held.includes(p);
const report = (key: string) => {
  const found = catalog.AMLA_REPORT_CATALOG.find((r) => r.key === key);
  assert.ok(found, key);
  return found;
};

test("the catalog lists the ten AMLA reports, by the server's keys and titles, each opening its page under /amla", () => {
  assert.deepEqual(
    catalog.AMLA_REPORT_CATALOG.map((r) => [r.key, r.title]),
    [
      ["covered_transactions", "Covered Transactions"],
      ["suspicious_transactions", "Suspicious Transactions"],
      ["transaction_monitoring", "Transaction Monitoring"],
      ["risk_assessment", "Customer AML Risk Assessment"],
      ["customer_due_diligence", "Customer Due Diligence"],
      ["watchlist_screening", "Watchlist and Sanctions Screening"],
      ["case_register", "Compliance Case Register"],
      ["submissions_register", "Regulatory Submissions Register"],
      ["audit_history", "Compliance Audit and History"],
      ["management_summary", "AMLA Management Summary"],
    ],
  );
  assert.ok(catalog.AMLA_REPORT_CATALOG.every((r) => r.available && r.href === `/amla/reports/${r.key}`));
});

test("each report is gated exactly as the server gates it: its own key, and head office for the confidential ones", () => {
  const gates = Object.fromEntries(catalog.AMLA_REPORT_CATALOG.map((r) => [r.key, [r.permissions, r.headOffice]]));
  assert.deepEqual(gates, {
    covered_transactions: [["amla:ctr"], false],
    suspicious_transactions: [["amla:str"], true],
    transaction_monitoring: [["amla:alerts"], false],
    risk_assessment: [["amla:cdd"], false],
    customer_due_diligence: [["amla:cdd"], false],
    watchlist_screening: [["amla:screening"], true],
    case_register: [["amla:cases"], true],
    submissions_register: [["amla:ctr", "amla:approve", "amla:submit", "amla:export", "amla:str"], false],
    audit_history: [["amla:audit"], true],
    management_summary: [["amla:view"], true],
  });
});

test("a report opens for its key; a confidential one also needs every branch", () => {
  assert.equal(access.amlaReportAccess(report("covered_transactions"), holds("amla:ctr")), "open");
  assert.equal(access.amlaReportAccess(report("covered_transactions"), holds("amla:str")), "no_access");
  assert.equal(access.amlaReportAccess(report("suspicious_transactions"), holds("amla:str")), "no_access");
  assert.equal(access.amlaReportAccess(report("suspicious_transactions"), holds("amla:str", "branches:view_all")), "open");
  assert.equal(access.amlaReportAccess(report("submissions_register"), holds("amla:submit")), "open");
});

test("the Reports page shows a user only the AMLA reports they can open", () => {
  assert.deepEqual(
    catalog.visibleAmlaReports(holds("amla:view", "amla:cdd", "amla:ctr")).map((r) => r.key),
    ["covered_transactions", "risk_assessment", "customer_due_diligence", "submissions_register"],
  );
  assert.deepEqual(
    catalog.visibleAmlaReports(holds("amla:view", "branches:view_all")).map((r) => r.key),
    ["management_summary"],
  );
  assert.deepEqual(catalog.visibleAmlaReports(holds("amla:view")), []);
});

test("without amla:view no AMLA report is listed, since their pages sit under /amla", () => {
  assert.deepEqual(catalog.visibleAmlaReports(holds("amla:cdd", "amla:ctr", "amla:audit", "branches:view_all")), []);
});

test("exporting needs amla:export as well as the report's own access", () => {
  assert.equal(access.amlaExportAllowed(report("covered_transactions"), holds("amla:ctr", "amla:export")), true);
  assert.equal(access.amlaExportAllowed(report("covered_transactions"), holds("amla:ctr")), false);
  assert.equal(access.amlaExportAllowed(report("audit_history"), holds("amla:audit", "amla:export")), false);
  assert.equal(access.amlaExportAllowed(report("audit_history"), holds("amla:audit", "amla:export", "branches:view_all")), true);
});

test("every AMLA report's card has a 3D icon mapped from its line icon", async () => {
  const { REPORT_ICONS_3D } = await import("@/app/(app)/reports/_lib/report-icons-3d");
  for (const r of catalog.AMLA_REPORT_CATALOG) assert.ok(REPORT_ICONS_3D.has(r.icon), `${r.key} has no 3D icon`);
});
