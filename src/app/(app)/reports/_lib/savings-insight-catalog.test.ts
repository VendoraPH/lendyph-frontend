/**
 * The gap round's savings reports in the catalog: each one's path, filters
 * (product included) and CSV. Driven over real HTTP against a stub, as
 * `report-catalog.test.ts` does, because a wrong path or a dropped parameter
 * is invisible to the types.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

const requests: URL[] = [];
let server: Server;

before(async () => {
  server = createServer((req, res) => {
    requests.push(new URL(req.url ?? "/", "http://127.0.0.1"));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: true, data: [], meta: { total: 0 }, totals: {} }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}`;
});

after(() => {
  server.close();
});

async function reportDefinition(id: string) {
  const { REPORT_CATALOG } = await import("./report-catalog");
  const report = REPORT_CATALOG.find((r) => r.id === id);
  assert.ok(report, `report ${id} is not in the catalog`);
  return report;
}

const RANGE = { from: "2026-11-01", to: "2026-11-12" };

/** [id, path, sends dates] */
const LIST_REPORTS: Array<[string, string, boolean]> = [
  ["savings_summary", "/reports/savings/summary", true],
  ["savings_accounts", "/reports/savings/accounts", false],
  ["savings_deposits", "/reports/savings/deposits", true],
  ["savings_withdrawals", "/reports/savings/withdrawals", true],
  ["savings_large_transactions", "/reports/savings/large-transactions", true],
  ["savings_time_deposits", "/reports/savings/time-deposits", false],
  ["savings_interest_accrual", "/reports/savings/interest-accrual", false],
  ["savings_account_activity", "/reports/savings/account-activity", true],
];

test("every new savings report is listed only with the savings switch and savings:view", async () => {
  const { visibleReports } = await import("./report-catalog");
  const ids = visibleReports(() => true).map((r) => r.id);
  for (const id of [...LIST_REPORTS.map(([i]) => i), "savings_member_statement"]) {
    const report = await reportDefinition(id);
    assert.equal(report.category, "savings", id);
    assert.equal(report.permission, "savings:view", id);
    assert.equal(report.available, false, id);
    assert.equal(ids.includes(report.id), false, id);
  }
});

test("each list report reads its own path with the branch, the product, and its dates when it has any", async () => {
  for (const [id, path, dated] of LIST_REPORTS) {
    const report = await reportDefinition(id);
    assert.equal(report.supportsBranch, true, id);
    assert.equal(report.supportsProduct, true, id);
    assert.equal(report.noDateRange === true, !dated, id);
    requests.length = 0;
    await report.build({ range: RANGE, branchId: 2, productId: 5 });
    assert.equal(requests.length, 1, id);
    assert.equal(requests[0].pathname, path, id);
    assert.equal(requests[0].searchParams.get("branch_id"), "2", id);
    assert.equal(requests[0].searchParams.get("product_id"), "5", id);
    assert.equal(requests[0].searchParams.get("date_from"), dated ? RANGE.from : null, id);
  }
});

test("no product is sent when none is picked", async () => {
  requests.length = 0;
  await (await reportDefinition("savings_deposits")).build({ range: RANGE, branchId: null, productId: null });
  assert.equal(requests[0].searchParams.has("product_id"), false);
  assert.equal(requests[0].searchParams.has("branch_id"), false);
});

test("the first seven savings reports take the product too, except the GL control and the account statement", async () => {
  for (const id of ["savings_balances", "savings_transactions", "time_deposit_maturities", "savings_interest_postings", "savings_dormant"]) {
    const report = await reportDefinition(id);
    assert.equal(report.supportsProduct, true, id);
    requests.length = 0;
    await report.build({ range: RANGE, productId: 3 });
    assert.equal(requests[0].searchParams.get("product_id"), "3", id);
  }
  assert.equal((await reportDefinition("savings_gl_control")).supportsProduct, undefined);
  assert.equal((await reportDefinition("savings_statement")).supportsProduct, undefined);
});

test("the deposit summary groups by branch by default, or by product", async () => {
  const summary = await reportDefinition("savings_summary");
  assert.deepEqual(
    summary.groupBy?.options.map((o) => o.value),
    ["branch", "product"],
  );
  requests.length = 0;
  await summary.build({ range: RANGE, groupBy: "product" });
  assert.equal(requests[0].searchParams.get("group_by"), "product");
});

test("the member statement reads the member picked, over the period, and nothing without one", async () => {
  const statement = await reportDefinition("savings_member_statement");
  assert.equal(statement.subject, "borrower");
  requests.length = 0;
  await statement.build({ range: RANGE, subjectId: 9 });
  assert.equal(requests[0].pathname, "/reports/savings/member-statement/9");
  assert.equal(requests[0].searchParams.get("date_from"), RANGE.from);
  requests.length = 0;
  await statement.build({ range: RANGE, subjectId: null });
  assert.equal(requests.length, 0);
});

test("each savings report's CSV is the server's own export, with the filters the preview used", async () => {
  const { savingsCsvReport } = await import("./savings-csv");
  const { reportScopeParams } = await import("./report-catalog");
  assert.equal(savingsCsvReport("savings_summary", null), "summary");
  assert.equal(savingsCsvReport("savings_accounts", null), "accounts");
  assert.equal(savingsCsvReport("savings_large_transactions", null), "large-transactions");
  assert.equal(savingsCsvReport("savings_balances", null), "balances");
  assert.equal(savingsCsvReport("savings_member_statement", 9), "member-statement/9");
  assert.equal(savingsCsvReport("savings_member_statement", null), null);
  assert.equal(savingsCsvReport("savings_statement", 4), null);
  assert.equal(savingsCsvReport("releases_list", null), null);
  assert.deepEqual(reportScopeParams({ range: RANGE, branchId: 2, productId: 5, groupBy: "product" }), {
    branch_id: 2,
    product_id: 5,
    group_by: "product",
  });
  assert.deepEqual(reportScopeParams({ range: RANGE }), {});
});
