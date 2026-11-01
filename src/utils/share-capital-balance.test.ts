/**
 * `getShareCapitalBalance` over REAL HTTP against a stub ledger, for what a
 * pure test cannot show: whether a request goes out at all, what it asks for,
 * and that the balance is the server's `meta.summary.ending_balance`.
 *
 * Without `share_capital:view` the ledger answers 403, and a refused read and
 * a skipped one both come back `unavailable` — so only the stub's request log
 * tells them apart.
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

let server: Server;
let requests: string[] = [];
let queries: Record<string, string>[] = [];
let getShareCapitalBalance: typeof import("./share-capital").getShareCapitalBalance;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    requests.push(url.pathname.replace(/^\/api/, ""));
    queries.push(Object.fromEntries(url.searchParams));
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        // One row of a long ledger: adding up what is in hand would give 5000.
        data: [{ id: 240, borrower_id: 7, debit: 0, credit: 5000, running_balance: 3500 }],
        meta: {
          current_page: 1,
          last_page: 240,
          per_page: 1,
          total: 240,
          summary: {
            opening_balance: 0,
            total_credits: 9500,
            total_debits: 6000,
            ending_balance: 3500,
          },
        },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  // Outside the browser the client calls NEXT_PUBLIC_API_URL directly.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ getShareCapitalBalance } = await import("./share-capital"));
});

after(() => {
  server.close();
});

beforeEach(() => {
  requests = [];
  queries = [];
});

test("without share_capital:view it asks for nothing and reports unavailable", async () => {
  assert.deepEqual(await getShareCapitalBalance(7, false), { status: "unavailable" });
  assert.deepEqual(requests, []);
});

test("with it, the balance is the server's ending balance from one request", async () => {
  const result = await getShareCapitalBalance(7, true);
  assert.equal(result.status, "ok");
  assert.equal(result.status === "ok" ? result.balance : null, 3500);
  assert.deepEqual(requests, ["/share-capital/ledger"]);
  // The member's whole ledger: no date range, and one row is all it needs.
  assert.deepEqual(queries, [{ borrower_id: "7", per_page: "1" }]);
});

test("callers that pass nothing keep reading the ledger", async () => {
  assert.equal((await getShareCapitalBalance(7)).status, "ok");
  assert.equal(requests.length, 1);
});
