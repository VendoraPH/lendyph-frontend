/**
 * The savings services against a `node:http` stub of the contract in
 * docs/SAVINGS_BACKEND_HANDOFF.md.
 *
 * WHAT THIS PROVES: money-moving POSTs carry the form's `Idempotency-Key`
 * header (and send none when no key could be minted), `listAll` drains past
 * the 100-row page clamp, and the list helpers keep `meta` (stats, totals).
 * WHAT IT DOES NOT PROVE: anything about the backend, which does not exist yet.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";

interface Seen {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: IncomingHttpHeaders;
  body: unknown;
}

const seen: Seen[] = [];
let server: Server;

const ACCOUNT_COUNT = 230;

let savingsAccountService: typeof import("./savings-account.service").savingsAccountService;
let savingsTransactionService: typeof import("./savings-transaction.service").savingsTransactionService;
let savingsProductService: typeof import("./savings-product.service").savingsProductService;

function page(total: number, pageNo: number, perPage: number, extraMeta = {}) {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const start = (pageNo - 1) * perPage;
  const data = Array.from({ length: Math.max(0, Math.min(perPage, total - start)) }, (_, i) => ({
    id: start + i + 1,
  }));
  return {
    data,
    meta: { current_page: pageNo, last_page: lastPage, per_page: perPage, total, ...extraMeta },
  };
}

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const path = url.pathname.replace(/^\/api/, "");
      const query = Object.fromEntries(url.searchParams.entries());
      seen.push({
        method: req.method ?? "GET",
        path,
        query,
        headers: req.headers,
        body: raw ? JSON.parse(raw) : null,
      });
      res.setHeader("Content-Type", "application/json");

      const pageNo = Number.parseInt(query.page ?? "1", 10) || 1;
      const perPage = Math.min(Number.parseInt(query.per_page ?? "15", 10) || 15, 100);

      if (path === "/savings/accounts" && req.method === "GET") {
        return res.end(
          JSON.stringify(page(ACCOUNT_COUNT, pageNo, perPage, { stats: { active: 200, closed: 30 } })),
        );
      }
      if (path === "/savings/transactions" && req.method === "GET") {
        return res.end(
          JSON.stringify(
            page(3, pageNo, perPage, {
              totals: { total_debit: "100.00", total_credit: "250.50", count: 3 },
            }),
          ),
        );
      }
      if (path === "/savings/products" && req.method === "GET") {
        return res.end(JSON.stringify(page(2, pageNo, perPage, { stats: { active: 1, inactive: 1 } })));
      }
      if (req.method === "POST") {
        return res.end(JSON.stringify({ success: true, data: { id: 99, reference_number: "SD-1" } }));
      }
      res.statusCode = 404;
      return res.end(JSON.stringify({ success: false, message: "Not found" }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  // Set BEFORE importing: axios-client resolves its baseURL at module init.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;

  savingsAccountService = (await import("./savings-account.service")).savingsAccountService;
  savingsTransactionService = (await import("./savings-transaction.service")).savingsTransactionService;
  savingsProductService = (await import("./savings-product.service")).savingsProductService;
});

after(() => {
  server?.close();
});

const lastPost = (path: string) => [...seen].reverse().find((s) => s.method === "POST" && s.path === path);

describe("Idempotency-Key on money-moving POSTs", () => {
  test("deposit, withdrawal and transfer send the form's key", async () => {
    const payload = {
      account_id: 1,
      amount: 500,
      transaction_date: "2026-11-03",
      payment_method: "cash" as const,
    };
    await savingsTransactionService.deposit(payload, "key-deposit");
    await savingsTransactionService.withdraw(payload, "key-withdraw");
    await savingsTransactionService.transfer(
      { from_account_id: 1, to_account_id: 2, amount: 10, transaction_date: "2026-11-03" },
      "key-transfer",
    );

    assert.equal(lastPost("/savings/deposits")?.headers["idempotency-key"], "key-deposit");
    assert.equal(lastPost("/savings/withdrawals")?.headers["idempotency-key"], "key-withdraw");
    assert.equal(lastPost("/savings/transfers")?.headers["idempotency-key"], "key-transfer");
    assert.deepEqual(lastPost("/savings/deposits")?.body, payload);
  });

  test("no key minted → no header, rather than an empty one", async () => {
    await savingsTransactionService.deposit(
      { account_id: 1, amount: 1, transaction_date: "2026-11-03", payment_method: "cash" },
      null,
    );
    assert.equal(lastPost("/savings/deposits")?.headers["idempotency-key"], undefined);
  });

  test("account opening and reversal send it too", async () => {
    await savingsAccountService.open(
      {
        borrower_id: 1,
        savings_product_id: 1,
        opened_at: "2026-11-03",
        initial_deposit: 100,
        payment_method: "cash",
      },
      "key-open",
    );
    await savingsTransactionService.reverse(5, "wrong account", "key-reverse");
    assert.equal(lastPost("/savings/accounts")?.headers["idempotency-key"], "key-open");
    assert.equal(lastPost("/savings/transactions/5/reverse")?.headers["idempotency-key"], "key-reverse");
  });
});

describe("lists keep meta and drain past the page clamp", () => {
  test("accounts listAll drains every page at per_page 100", async () => {
    const drained = await savingsAccountService.listAll({ status: "active" });
    assert.equal(drained.rows.length, ACCOUNT_COUNT);
    assert.equal(drained.truncated, false);
    const gets = seen.filter((s) => s.method === "GET" && s.path === "/savings/accounts");
    assert.ok(gets.every((g) => g.query.per_page === "100" && g.query.status === "active"));
  });

  test("account list keeps meta.stats; transactions keep meta.totals", async () => {
    const accounts = await savingsAccountService.list({ page: 1, per_page: 15 });
    assert.deepEqual(accounts.meta.stats, { active: 200, closed: 30 });
    const tx = await savingsTransactionService.list({ page: 1 });
    assert.equal(tx.meta.totals?.total_credit, "250.50");
    const products = await savingsProductService.list({ page: 1, per_page: 20 });
    assert.deepEqual(products.meta.stats, { active: 1, inactive: 1 });
  });
});
