/**
 * `executiveDashboardService`, driven over REAL HTTP against a stub that
 * mirrors the sibling repo's EB-D1 (`ExecutiveDashboardController`,
 * `ExecutiveDashboardRequest`, `ParLoansRequest`).
 *
 * WHAT THIS PROVES: the dashboard asks the server for a preset by name (the
 * server works out the dates in Manila), sends dates only for a custom range,
 * reads the overview and branches out of their `data`, and keeps the PAR
 * loans' paging `meta`.
 * WHAT IT DOES NOT PROVE: that the real controller behaves as written. That is
 * ExecutiveOverviewTest, ExecutiveBranchesTest and ParLoansTest in the backend.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { getErrorMessage } from "@/lib/api-error";

let server: Server;
let requests: Array<{ path: string; query: Record<string, string> }> = [];
let executiveDashboardService: typeof import("./executive-dashboard.service").executiveDashboardService;

const period = { preset: "last_7_days", label: "Last 7 Days", from: "2026-11-13", to: "2026-11-19", days: 7, previous: { from: "2026-11-06", to: "2026-11-12", days: 7 }, as_of: "2026-11-19" };

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname.replace(/^\/api/, "");
    const query = Object.fromEntries(url.searchParams.entries());
    requests.push({ path, query });
    res.setHeader("Content-Type", "application/json");
    // DashboardPeriod::custom(): an end before the start is refused on date_to.
    if (query.preset === "custom" && query.date_to < query.date_from) {
      res.statusCode = 422;
      return res.end(JSON.stringify({ message: "The end date can't be before the start date.", errors: { date_to: ["The end date can't be before the start date."] } }));
    }
    if (path === "/dashboard/executive/overview") return res.end(JSON.stringify({ data: { period, generated_at: "2026-11-19 09:00:00", filters_applied: [], cards: {} } }));
    if (path === "/dashboard/executive/branches") return res.end(JSON.stringify({ data: { period, rows: [], totals: {} } }));
    if (path === "/dashboard/executive/par-loans") {
      return res.end(JSON.stringify({ data: [{ loan_id: 1 }], meta: { par: `par_${query.par}`, current_page: Number(query.page), last_page: 3, per_page: 25, total: 51, totals: { loans: 51, outstanding_principal: 1000 }, filters_applied: [] } }));
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ message: "not stubbed" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ executiveDashboardService } = await import("./executive-dashboard.service"));
});

after(() => {
  server?.close();
});

describe("executiveDashboardService", () => {
  test("the overview asks for the preset by name and reads the server's period", async () => {
    requests = [];
    const overview = await executiveDashboardService.overview({ preset: "last_7_days", branch_id: 2 });
    assert.deepEqual(requests, [{ path: "/dashboard/executive/overview", query: { preset: "last_7_days", branch_id: "2" } }]);
    assert.equal(overview.period.from, "2026-11-13");
  });

  test("the branches table reads its data", async () => {
    requests = [];
    const branches = await executiveDashboardService.branches({ preset: "custom", date_from: "2026-10-01", date_to: "2026-10-31" });
    assert.deepEqual(requests[0], {
      path: "/dashboard/executive/branches",
      query: { preset: "custom", date_from: "2026-10-01", date_to: "2026-10-31" },
    });
    assert.deepEqual(branches.rows, []);
  });

  test("the PAR loans keep their paging meta", async () => {
    requests = [];
    const page = await executiveDashboardService.parLoans({ preset: "this_month" }, { par: "60", page: 2 });
    assert.deepEqual(requests[0].query, { preset: "this_month", par: "60", page: "2", per_page: "25" });
    assert.equal(page.meta.total, 51);
    assert.equal(page.meta.par, "par_60");
  });

  test("a refused custom range reads the server's words", async () => {
    const err = await executiveDashboardService.overview({ preset: "custom", date_from: "2026-10-31", date_to: "2026-10-01" }).catch((e) => e);
    assert.equal(getErrorMessage(err, "fallback"), "The end date can't be before the start date.");
  });
});
