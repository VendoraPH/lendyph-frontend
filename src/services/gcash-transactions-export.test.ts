/**
 * The GCash Transactions report's data, pinned at the wire.
 *
 * The report shows the server's totals, never a sum of the rows. The drain
 * that fetches every row keeps only rows and paging, so `listAllTransactions`
 * reads `meta.totals` off its own first page, which carries the same filters.
 *
 * WHAT THIS PROVES: every page is asked with the tab's filters, and page 1's
 * `meta.totals` comes back with the rows (null when the server sends none).
 * WHAT IT DOES NOT PROVE: the figures themselves; they are the backend's.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

const ROWS = Array.from({ length: 150 }, (_, i) => ({ id: 150 - i, reference_no: `GC-${150 - i}` }));
const TOTALS = {
  count: 150,
  amount: "175000.50",
  cash_in: "150000.00",
  cash_out: "25000.50",
  charges: "3150.25",
  total: "175150.75",
};

let server: Server;
const seen: Record<string, string>[] = [];
/** What `meta.totals` page 1 carries; undefined leaves the key out. */
let firstPageTotals: unknown = TOTALS;
let gcashService: typeof import("./gcash.service").gcashService;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    res.setHeader("Content-Type", "application/json");
    if (req.method !== "GET" || url.pathname.replace(/^\/api/, "") !== "/gcash/transactions") {
      res.statusCode = 404;
      return res.end(JSON.stringify({ message: "not stubbed" }));
    }
    const query = Object.fromEntries(url.searchParams);
    seen.push(query);
    const page = Number(query.page ?? 1);
    const perPage = Math.min(Number(query.per_page ?? 25), 100);
    const meta: Record<string, unknown> = {
      current_page: page,
      last_page: Math.ceil(ROWS.length / perPage),
      per_page: perPage,
      total: ROWS.length,
    };
    // Only page 1 carries totals here, so a drain that kept a later page's would lose them.
    if (page === 1 && firstPageTotals !== undefined) meta.totals = firstPageTotals;
    res.end(JSON.stringify({ data: ROWS.slice((page - 1) * perPage, page * perPage), links: {}, meta }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  // Outside the browser the client calls NEXT_PUBLIC_API_URL directly.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ gcashService } = await import("./gcash.service"));
});

after(() => {
  server?.close();
});

describe("gcashService.listAllTransactions", () => {
  const filters = { type: "cash_in", status: "paid", start_date: "2026-11-01", end_date: "2026-11-30" } as const;

  test("every row, and page 1's meta.totals, asked with the tab's filters", async () => {
    seen.length = 0;
    firstPageTotals = TOTALS;
    const result = await gcashService.listAllTransactions(filters);
    assert.equal(result.rows.length, 150);
    assert.equal(result.total, 150);
    assert.equal(result.truncated, false);
    assert.deepEqual(result.totals, TOTALS);
    assert.equal(seen.length, 2);
    for (const query of seen) {
      assert.deepEqual(
        [query.type, query.status, query.start_date, query.end_date],
        ["cash_in", "paid", "2026-11-01", "2026-11-30"],
      );
    }
  });

  test("no meta.totals, or an empty one, is null: the report shows dashes", async () => {
    firstPageTotals = undefined;
    assert.equal((await gcashService.listAllTransactions(filters)).totals, null);
    // PHP sends an empty array as [], never {}.
    firstPageTotals = [];
    assert.equal((await gcashService.listAllTransactions(filters)).totals, null);
  });
});
