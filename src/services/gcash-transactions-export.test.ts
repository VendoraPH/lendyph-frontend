/**
 * The GCash Transactions report's data, pinned at the wire.
 *
 * The report shows the server's totals, never a sum of the rows. The drain
 * that fetches every row keeps only rows and paging, so `listAllTransactions`
 * reads `meta.totals` off its own first and last pages, which carry the same
 * filters. Like the backend, the stub works the totals out on every request.
 *
 * WHAT THIS PROVES: every page is asked with the tab's filters, the first and
 * last pages' `meta.totals` come back with the rows (null when the server
 * sends none), and a list that moves between pages is refused for export.
 * WHAT IT DOES NOT PROVE: the figures themselves; they are the backend's.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { TRANSACTIONS_CHANGED, transactionsExportRefusal } from "@/app/(app)/gcash/_lib/transactions-report";

/** Newest first. Rows 60 and 10 are pending Cash Ins; row 10 is on page 2. */
const ROWS = Array.from({ length: 150 }, (_, i) => {
  const id = 150 - i;
  return { id, reference_no: `GC-${id}`, status: id === 60 || id === 10 ? "pending" : "completed" };
});
const TOTALS = {
  count: 150,
  amount: "175000.50",
  cash_in: "150000.00",
  cash_out: "25000.50",
  charges: "3150.25",
  total: "178150.25",
  pending: { count: 2, amount: "3000.00", charges: "40.00", total: "3040.00" },
};

let server: Server;
const seen: Record<string, string>[] = [];
/** The list as the server holds it now; a test may change it between pages. */
let listed = ROWS;
/** What `meta.totals` carries on every page, as the server works it out now; undefined leaves it out. */
let serverTotals: unknown = TOTALS;
/** Runs before each page is answered, with that page's number. */
let beforePage: (page: number) => void = () => {};
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
    beforePage(page);
    const meta: Record<string, unknown> = {
      current_page: page,
      last_page: Math.ceil(listed.length / perPage),
      per_page: perPage,
      total: listed.length,
    };
    if (serverTotals !== undefined) meta.totals = serverTotals;
    res.end(JSON.stringify({ data: listed.slice((page - 1) * perPage, page * perPage), links: {}, meta }));
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

  /** A test that changes the server between pages puts it back. */
  async function drainWhile(change: (page: number) => void, params: Parameters<typeof gcashService.listAllTransactions>[0]) {
    beforePage = change;
    try {
      return await gcashService.listAllTransactions(params);
    } finally {
      listed = ROWS;
      serverTotals = TOTALS;
      beforePage = () => {};
    }
  }

  test("every row, and the first and last pages' meta.totals, asked with the tab's filters", async () => {
    seen.length = 0;
    const result = await gcashService.listAllTransactions(filters);
    assert.equal(result.rows.length, 150);
    assert.equal(result.total, 150);
    assert.equal(result.truncated, false);
    assert.deepEqual(result.totals, TOTALS);
    assert.deepEqual(result.lastPageTotals, TOTALS);
    assert.equal(transactionsExportRefusal(result), null);
    assert.equal(seen.length, 2);
    for (const query of seen) {
      assert.deepEqual(
        [query.type, query.status, query.start_date, query.end_date],
        ["cash_in", "paid", "2026-11-01", "2026-11-30"],
      );
    }
  });

  test("no meta.totals, or an empty one, is null: the report shows dashes", async () => {
    try {
      serverTotals = undefined;
      const none = await gcashService.listAllTransactions(filters);
      assert.deepEqual([none.totals, none.lastPageTotals], [null, null]);
      // PHP sends an empty array as [], never {}.
      serverTotals = [];
      const empty = await gcashService.listAllTransactions(filters);
      assert.deepEqual([empty.totals, empty.lastPageTotals], [null, null]);
    } finally {
      serverTotals = TOTALS;
    }
  });

  test("a transaction recorded between pages repeats a row, and the export is refused", async () => {
    // Recorded after page 1 was answered: it lands on top and pushes every row down one.
    const result = await drainWhile((page) => {
      if (page !== 2) return;
      listed = [{ id: 151, reference_no: "GC-151", status: "completed" }, ...ROWS];
      serverTotals = { ...TOTALS, count: 151 };
    }, filters);
    assert.equal(result.rows.filter((row) => row.id === 51).length, 2);
    assert.equal(transactionsExportRefusal(result), TRANSACTIONS_CHANGED);
  });

  test("a transaction marked paid between pages changes the totals, and the export is refused", async () => {
    // Status "All": the row stays in the list, in its place. Only the totals show the change.
    const result = await drainWhile(
      (page) => {
        if (page !== 2) return;
        listed = ROWS.map((row) => (row.id === 10 ? { ...row, status: "paid" } : row));
        serverTotals = { ...TOTALS, pending: { count: 1, amount: "1500.00", charges: "20.00", total: "1520.00" } };
      },
      { start_date: "2026-11-01", end_date: "2026-11-30" },
    );
    assert.equal(result.rows.length, 150);
    assert.equal(new Set(result.rows.map((row) => row.id)).size, 150);
    // The document would print row 10 as Paid beside page 1's totals, which count it as pending.
    assert.equal(result.rows.find((row) => row.id === 10)?.status, "paid");
    assert.equal(result.totals?.pending.count, 2);
    assert.equal(transactionsExportRefusal(result), TRANSACTIONS_CHANGED);
  });
});
