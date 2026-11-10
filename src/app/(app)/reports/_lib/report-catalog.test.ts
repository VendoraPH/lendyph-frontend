/**
 * The two pieces of round fx that live in the catalog's wiring rather than a
 * builder: the Statement of Account takes no date range, and the Member Report
 * reads GET /reports/borrowers/list. Driven over real HTTP against a stub, as
 * `src/services/list-truncation.test.ts` does, because a wrong path or a dropped
 * parameter is invisible to the types.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

const requests: URL[] = [];
let server: Server;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    requests.push(url);
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/reports/borrowers/list") {
      res.end(
        JSON.stringify({
          data: [{ borrower_id: 5, borrower_code: "MB-0005", borrower_name: "Ana Cruz", is_new: true, is_repeat: false }],
          meta: { total: 1, counts: { active: 0, new: 1, repeat: 0 } },
        })
      );
      return;
    }
    if (url.pathname.startsWith("/reports/statement-of-account/")) {
      res.end(JSON.stringify({ success: true, data: { as_of: "2026-11-05" } }));
      return;
    }
    res.end(JSON.stringify({ success: true, data: { new_borrowers: 1 } }));
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

const RANGE = { from: "2026-08-01", to: "2026-08-06" };

test("the Statement of Account takes no date range, and the other subject report keeps its own", async () => {
  assert.equal((await reportDefinition("statement_of_account")).noDateRange, true);
  assert.equal((await reportDefinition("subsidiary_ledger")).noDateRange, undefined);
  assert.equal((await reportDefinition("income_report")).noDateRange, undefined);
});

test("the Portfolio Summary opens on the whole portfolio: no dates asked, the branch kept", async () => {
  requests.length = 0;
  const report = await reportDefinition("portfolio_summary");
  assert.equal(report.noDateRange, true);

  const doc = await report.build({ range: RANGE, branchId: 3 });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].searchParams.has("date_from"), false);
  assert.equal(requests[0].searchParams.has("date_to"), false);
  assert.equal(requests[0].searchParams.get("branch_id"), "3");
  assert.ok(doc.meta.asOf);
  assert.equal(doc.meta.period, undefined);
});

test("every other portfolio report still asks for its dates", async () => {
  requests.length = 0;
  await (await reportDefinition("income_report")).build({ range: RANGE });
  assert.ok(requests.some((r) => r.searchParams.get("date_from") === RANGE.from));
});

test("the Statement of Account asks for no dates and prints the server's As of", async () => {
  requests.length = 0;
  const report = await reportDefinition("statement_of_account");
  const doc = await report.build({ range: RANGE, subjectId: 4 });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].pathname, "/reports/statement-of-account/4");
  assert.equal(requests[0].searchParams.has("date_from"), false);
  assert.equal(requests[0].searchParams.has("date_to"), false);
  assert.ok(doc.meta.asOf);
  assert.equal(doc.meta.period, undefined);
});

test("the Member Report reads the member list with the period and a page size", async () => {
  requests.length = 0;
  const report = await reportDefinition("borrower_report");
  const doc = await report.build({ range: RANGE });

  const list = requests.find((r) => r.pathname === "/reports/borrowers/list");
  assert.ok(list, "the member list was not requested");
  assert.equal(list.searchParams.get("date_from"), RANGE.from);
  assert.equal(list.searchParams.get("date_to"), RANGE.to);
  assert.equal(list.searchParams.get("per_page"), "200");
  assert.equal(requests.some((r) => r.pathname === "/reports/borrowers/released"), false);

  const table = doc.sections.find((s) => s.kind === "table");
  assert.ok(table && table.kind === "table");
  assert.equal(table.rows[0].borrower_name, "Ana Cruz");
});

const SAVINGS_REPORT_IDS = [
  "savings_balances",
  "savings_transactions",
  "time_deposit_maturities",
  "savings_interest_postings",
  "savings_dormant",
  "savings_statement",
  "savings_gl_control",
];

test("the savings reports stay off the list unless savings is switched on and the user can read it", async () => {
  const { visibleReports } = await import("./report-catalog");
  // NEXT_PUBLIC_ENABLE_SAVINGS is unset here, so even an all-powerful user
  // doesn't see them; the loan reports are unaffected.
  const ids = visibleReports(() => true).map((r) => r.id);
  for (const id of SAVINGS_REPORT_IDS) {
    assert.equal(ids.includes(id as never), false, id);
    const report = await reportDefinition(id);
    assert.equal(report.permission, "savings:view", id);
    assert.equal(report.available, false, id);
    assert.equal(report.category, "savings", id);
  }
  assert.ok(ids.includes("releases_list"));
});

test("the point-in-time savings reports send no dates; the period reports send theirs", async () => {
  const cases: Array<[string, string, boolean]> = [
    ["savings_balances", "/reports/savings/balances", false],
    ["savings_dormant", "/reports/savings/dormant", false],
    ["savings_gl_control", "/reports/savings/gl-control", false],
    ["savings_transactions", "/reports/savings/transactions", true],
    ["time_deposit_maturities", "/reports/savings/time-deposit-maturities", true],
    ["savings_interest_postings", "/reports/savings/interest-postings", true],
  ];
  for (const [id, path, dated] of cases) {
    requests.length = 0;
    await (await reportDefinition(id)).build({ range: RANGE, branchId: 2 });
    assert.equal(requests.length, 1, id);
    assert.equal(requests[0].pathname, path, id);
    assert.equal(requests[0].searchParams.get("branch_id"), "2", id);
    assert.equal(requests[0].searchParams.get("date_from"), dated ? RANGE.from : null, id);
    assert.equal(requests[0].searchParams.get("date_to"), dated ? RANGE.to : null, id);
    if (id !== "savings_gl_control") {
      assert.equal(requests[0].searchParams.get("per_page"), "200", id);
    }
  }
});

test("the savings statement reads the account it was opened for, over the period, and nothing without one", async () => {
  const statement = await reportDefinition("savings_statement");
  assert.equal(statement.accountParam, true);
  assert.equal(statement.subject, undefined);

  requests.length = 0;
  await statement.build({ range: RANGE, subjectId: 7 });
  assert.equal(requests[0].pathname, "/reports/savings/statement/7");
  assert.equal(requests[0].searchParams.get("date_from"), RANGE.from);
  assert.equal(requests[0].searchParams.get("date_to"), RANGE.to);

  requests.length = 0;
  await statement.build({ range: RANGE, subjectId: null });
  assert.equal(requests.length, 0);
});

test("Time Deposit Maturities opens on the whole month, and the savings statement offers no CSV", async () => {
  assert.equal((await reportDefinition("time_deposit_maturities")).defaultPeriod, "whole_month");
  assert.equal((await reportDefinition("savings_balances")).defaultPeriod, undefined);
  assert.equal((await reportDefinition("savings_statement")).noCsv, true);
  assert.equal((await reportDefinition("savings_transactions")).noCsv, undefined);
});
