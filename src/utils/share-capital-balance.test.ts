/**
 * `getShareCapitalBalance` over REAL HTTP against a stub ledger, for the one
 * thing a pure test cannot show: whether a request goes out at all.
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
let getShareCapitalBalance: typeof import("./share-capital").getShareCapitalBalance;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    requests.push(url.pathname.replace(/^\/api/, ""));
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        data: [
          { id: 1, borrower_id: 7, debit: 0, credit: 5000 },
          { id: 2, borrower_id: 7, debit: 1500, credit: 0 },
        ],
        meta: { current_page: 1, last_page: 1, per_page: 100, total: 2 },
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
});

test("without share_capital:view it asks for nothing and reports unavailable", async () => {
  assert.deepEqual(await getShareCapitalBalance(7, false), { status: "unavailable" });
  assert.deepEqual(requests, []);
});

test("with it, the balance is read from the ledger as before", async () => {
  const result = await getShareCapitalBalance(7, true);
  assert.equal(result.status, "ok");
  assert.equal(result.status === "ok" ? result.balance : null, 3500);
  assert.deepEqual(requests, ["/share-capital/ledger"]);
});

test("callers that pass nothing keep reading the ledger", async () => {
  assert.equal((await getShareCapitalBalance(7)).status, "ok");
  assert.equal(requests.length, 1);
});
