import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { requestFailure } from "./reconciliation-view";

/**
 * The reconciliation screens' calls, over real HTTP against a stub of the
 * backend's answers, so the assertions are on the request actually sent.
 */
interface Recorded {
  method: string;
  path: string;
  body: unknown;
}

const WORKSHEET = { id: 7, account_id: 2, difference: 0, is_reconciled: true, lines: [] };
const CREATED = { type: "expense", id: 12, journal_id: 345, journal_no: "JE-000345" };
const IN_BOOKS =
  "This statement line matches JE-000345 already in the books. Match it instead, or record it anyway.";
const COLLISION = "Another change to this reconciliation was saved at the same time. Reload and try again.";

/** Line 98 is one the books already hold; line 99 collides on the journal number. */
const REFUSALS: Record<string, { status: number; body: unknown }> = {
  "/accounting/reconciliations/7/lines/98": { status: 422, body: { message: IN_BOOKS, errors: { line: [IN_BOOKS] } } },
  "/accounting/reconciliations/7/lines/99": { status: 409, body: { message: COLLISION } },
};

const RECONCILABLE = [
  { id: 2, code: "1010", name: "Cash on Hand", type: "Cash" },
  { id: 3, code: "1020", name: "Cash in Bank", type: "Bank" },
];
/** How the stub answers the reconcilable-accounts list. */
let accountsAnswer: "list" | "missing" | "refused" = "list";

let server: Server;
let requests: Recorded[] = [];
/** Each request's query string, kept apart so the recorded requests above stay as they were. */
let queries: string[] = [];
let api: typeof import("./reconciliation-api");
let accountingService: typeof import("@/services/accounting.service").accountingService;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname.replace(/^\/api/, "");
    queries.push(url.search);
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      requests.push({ method: req.method ?? "GET", path, body: raw ? JSON.parse(raw) : null });
      res.setHeader("Content-Type", "application/json");
      const refusal = REFUSALS[path.replace(/\/(expense|transfer|suspense)$/, "")];
      if (refusal) {
        res.statusCode = refusal.status;
        return res.end(JSON.stringify(refusal.body));
      }
      if (/\/lines\/\d+\/(expense|transfer|suspense)$/.test(path)) {
        res.statusCode = 201;
        return res.end(JSON.stringify({ data: WORKSHEET, created: CREATED }));
      }
      if (req.method === "GET" && path === "/accounting/reconciliations/accounts") {
        if (accountsAnswer === "missing") {
          res.statusCode = 404;
          return res.end(JSON.stringify({ message: "Not Found" }));
        }
        if (accountsAnswer === "refused") {
          res.statusCode = 403;
          return res.end(JSON.stringify({ message: "This action is unauthorized." }));
        }
        return res.end(JSON.stringify({ data: RECONCILABLE }));
      }
      if (req.method === "GET" && path === "/accounting/reconciliations") {
        return res.end(JSON.stringify({ data: [WORKSHEET], meta: { current_page: 1, last_page: 1, total: 1 } }));
      }
      if (req.method === "POST" && path === "/accounting/reconciliations") res.statusCode = 201;
      return res.end(JSON.stringify({ data: WORKSHEET }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  // Set BEFORE importing: axios-client resolves its baseURL at module init.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  api = await import("./reconciliation-api");
  ({ accountingService } = await import("@/services/accounting.service"));
});

after(() => {
  server?.close();
});

beforeEach(() => {
  requests = [];
  queries = [];
  accountsAnswer = "list";
});

function onlyRequest(): Recorded {
  assert.equal(requests.length, 1);
  return requests[0];
}

describe("the start form's reconcilable accounts", () => {
  test("GETs the reconcile-only list and reads id, code, name and type", async () => {
    const answer = await api.reconciliationAccounts();
    assert.deepEqual(onlyRequest(), { method: "GET", path: "/accounting/reconciliations/accounts", body: null });
    assert.deepEqual(answer, { state: "list", accounts: RECONCILABLE });
  });

  test("an older backend's 404 asks for today's list instead", async () => {
    accountsAnswer = "missing";
    assert.deepEqual(await api.reconciliationAccounts(), { state: "missing" });
  });

  test("any other refusal is a failure, never the fallback", async () => {
    accountsAnswer = "refused";
    assert.deepEqual(await api.reconciliationAccounts(), { state: "failed" });
  });
});

describe("reading and writing the worksheet", () => {
  test("show GETs one reconciliation and reads its data", async () => {
    const result = await api.reconciliationShow(7);
    assert.deepEqual(onlyRequest(), { method: "GET", path: "/accounting/reconciliations/7", body: null });
    assert.deepEqual(result, WORKSHEET);
  });

  test("create POSTs the body as built", async () => {
    const body = {
      account_id: 2,
      branch_id: 3,
      start_date: "2026-10-01",
      end_date: "2026-10-31",
      statement_balance: 2_485_050,
      lines: [{ date: "2026-10-05", description: "Bank charge", amount: -15_000 }],
    };
    const result = await api.reconciliationCreate(body);
    assert.deepEqual(onlyRequest(), { method: "POST", path: "/accounting/reconciliations", body });
    assert.equal(result.id, 7);
  });

  test("the list sends the branch filter: a branch id, all, or nothing", async () => {
    await accountingService.reconciliationsListAll({ branch_id: 3 });
    assert.match(queries[0], /[?&]branch_id=3(&|$)/);
    await accountingService.reconciliationsListAll({ branch_id: "all" });
    assert.match(queries[1], /[?&]branch_id=all(&|$)/);
    await accountingService.reconciliationsListAll();
    assert.doesNotMatch(queries[2], /branch_id/);
  });

  test("match POSTs a pairing, an unmatch or accept_suggestions", async () => {
    await api.reconciliationMatch(7, { matches: [{ line_id: 41, journal_line_id: null }] });
    assert.deepEqual(onlyRequest(), {
      method: "POST",
      path: "/accounting/reconciliations/7/match",
      body: { matches: [{ line_id: 41, journal_line_id: null }] },
    });

    requests = [];
    await api.reconciliationMatch(7, { accept_suggestions: true });
    assert.deepEqual(onlyRequest().body, { accept_suggestions: true });
  });
});

describe("the three line actions", () => {
  test("each POSTs to its own route and keeps created beside data", async () => {
    const cases = [
      ["expense", { expense_account_id: 4, payee: "BDO" }],
      ["transfer", { counter_account_id: 1 }],
      ["suspense", {}],
    ] as const;
    for (const [kind, body] of cases) {
      requests = [];
      const answer = await api.recordLine(kind, 7, 41, body);
      assert.deepEqual(onlyRequest(), {
        method: "POST",
        path: `/accounting/reconciliations/7/lines/41/${kind}`,
        body,
      });
      assert.deepEqual(answer, { data: WORKSHEET, created: CREATED });
    }
  });
});

describe("C5 review fixes, over HTTP", () => {
  test("Record anyway sends record_anyway: true with the same body", async () => {
    await api.recordLine("expense", 7, 41, { expense_account_id: 4, payee: "BDO", record_anyway: true });
    assert.deepEqual(onlyRequest().body, { expense_account_id: 4, payee: "BDO", record_anyway: true });
  });

  test("a line the books already hold: 422 with the two choices", async () => {
    const err = await api.recordLine("suspense", 7, 98, {}).then(
      () => assert.fail("expected a refusal"),
      (e: unknown) => e,
    );
    assert.deepEqual(requestFailure(err, { canViewAll: true }), {
      reload: false,
      message: IN_BOOKS,
      inBooks: true,
    });
  });

  test("a journal-number collision: 409 with the server's words, and the worksheet reloads", async () => {
    const cases = [
      ["expense", { expense_account_id: 4, payee: "BDO" }],
      ["transfer", { counter_account_id: 1 }],
      ["suspense", {}],
    ] as const;
    for (const [kind, body] of cases) {
      const err = await api.recordLine(kind, 7, 99, body).then(
        () => assert.fail("expected a refusal"),
        (e: unknown) => e,
      );
      assert.deepEqual(requestFailure(err, { canViewAll: true }), { reload: true, message: COLLISION });
    }
  });
});
