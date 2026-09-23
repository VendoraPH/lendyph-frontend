/**
 * `repaymentService`'s two lists, driven over REAL HTTP against a stub that
 * mirrors the sibling repo's `RepaymentController` — `index()` (one loan's
 * repayments), `listAll()` (everyone's, filterable) and `show()`.
 *
 * The loan ledger and the member Payments tab both read ONE page of
 * `GET /loans/{loan}/repayments` and took it for the whole history. That page
 * is the default 15, and the OLDEST 15, so every loan past its fifteenth
 * payment lost its newest. `api.get` had unwrapped the body to its rows and
 * dropped `meta`, so nothing could tell. The ledger then asked
 * `GET /repayments/{id}` for every row it did get, for a payload identical to
 * the row. The assertions are made on the wire, where all of that shows.
 *
 * WHAT THIS PROVES: the client drains every page at the ceiling, carries the
 * member filter on each request, makes no per-row request at all, and reports
 * a drain that could not finish.
 * WHAT IT DOES NOT PROVE: that the real controllers behave as written — there
 * is no database, no Eloquent and no policy layer here. The stub is only as
 * honest as the source it was read from.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

// ── The contract, mirrored from the sibling repo ────────────────────────────

interface Row {
  id: number;
  loan_id: number;
  borrower_id: number;
  payment_date: string;
  status: "posted" | "voided";
  principal: number;
  interest: number;
  penalty: number;
}

/** `index()`: `paginate(min((int) request('per_page', 15), 100))` — no floor of 1. */
const clampLoanList = (raw: string | undefined) =>
  Math.min(Number.parseInt(raw ?? "", 10) || 15, 100);
/** `listAll()`: `paginate(min(max((int) ($filters['per_page'] ?? 15), 1), 100))`. */
const clampAll = (raw: string | undefined) =>
  Math.min(Math.max(Number.parseInt(raw ?? "", 10) || 15, 1), 100);

/**
 * `RepaymentResource`: the allocation under `*_applied` plus the `*_amount`
 * and bare aliases, and no `*_paid` at all. The list endpoints and the detail
 * endpoint serialise exactly this, over the same eager loads.
 */
function serialise(r: Row) {
  return {
    id: r.id,
    receipt_number: `OR-${r.id}`,
    loan_id: r.loan_id,
    borrower_id: r.borrower_id,
    payment_date: r.payment_date,
    paid_at: r.payment_date,
    amount_paid: r.principal + r.interest + r.penalty,
    amount: r.principal + r.interest + r.penalty,
    principal_applied: r.principal,
    principal_amount: r.principal,
    principal: r.principal,
    interest_applied: r.interest,
    interest_amount: r.interest,
    interest: r.interest,
    penalty_applied: r.penalty,
    penalty_amount: r.penalty,
    penalty: r.penalty,
    status: r.status === "posted" ? "completed" : r.status,
    created_at: `${r.payment_date} 09:00:00`,
  };
}

function paginator(rows: Row[], page: number, perPage: number, extraMeta = {}) {
  const current = Math.max(1, page);
  return {
    data: rows.slice((current - 1) * perPage, current * perPage).map(serialise),
    links: {},
    meta: {
      current_page: current,
      last_page: Math.max(1, Math.ceil(rows.length / perPage)),
      per_page: perPage,
      total: rows.length,
      ...extraMeta,
    },
  };
}

// ── Seed ───────────────────────────────────────────────────────────────────

const MEMBER = 7;
/** Member 7: a daily loan (237 payments), a weekly one (40), a monthly one (3). */
const MEMBER_LOANS: Record<number, number> = { 1: 237, 2: 40, 3: 3 };
const MEMBER_PAYMENTS = 237 + 40 + 3;
/** Loan 5 belongs to someone else, and holds however many payments a test asks for. */
const SIZED_LOAN = 5;

function day(n: number): string {
  const d = new Date(Date.UTC(2026, 0, 1 + n));
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function seed(sizedLoanPayments = 0): Row[] {
  const rows: Row[] = [];
  let id = 1;
  const add = (loanId: number, borrowerId: number, count: number) => {
    for (let i = 0; i < count; i++) {
      rows.push({
        id: id++,
        loan_id: loanId,
        borrower_id: borrowerId,
        payment_date: day(i),
        status: i === 3 ? "voided" : "posted",
        principal: 400 + (i % 7),
        interest: 100,
        penalty: i % 5 === 0 ? 25 : 0,
      });
    }
  };
  for (const [loanId, count] of Object.entries(MEMBER_LOANS)) add(Number(loanId), MEMBER, count);
  add(4, 99, 20); // someone else's payments, which must not leak into member 7's tab
  add(SIZED_LOAN, 42, sizedLoanPayments);
  return rows;
}

// ── Harness ────────────────────────────────────────────────────────────────

let server: Server;
let requests: Array<{ path: string; query: Record<string, string> }> = [];
let rows = seed();

let repaymentService: typeof import("./repayment.service").repaymentService;
let repaymentList: typeof import("../lib/repayment-list");
let MAX_PER_PAGE: number;
let DEFAULT_MAX_PAGES: number;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname.replace(/^\/api/, "");
    const query = Object.fromEntries(url.searchParams.entries());
    requests.push({ path, query });
    res.setHeader("Content-Type", "application/json");
    const page = Number.parseInt(query.page ?? "1", 10) || 1;

    const loanList = path.match(/^\/loans\/(\d+)\/repayments$/);
    if (loanList) {
      // `Loan::repayments()` orders by payment_date ASC, and that clause
      // outranks the controller's `latest()` — oldest first.
      const mine = rows
        .filter((r) => r.loan_id === Number(loanList[1]))
        .sort((a, b) => a.payment_date.localeCompare(b.payment_date) || a.id - b.id);
      return res.end(JSON.stringify(paginator(mine, page, clampLoanList(query.per_page))));
    }

    if (path === "/repayments") {
      let found = rows;
      if (query.borrower_id) found = found.filter((r) => String(r.borrower_id) === query.borrower_id);
      if (query.loan_id) found = found.filter((r) => String(r.loan_id) === query.loan_id);
      if (query.status) found = found.filter((r) => r.status === query.status);
      found = [...found].sort((a, b) => b.payment_date.localeCompare(a.payment_date) || b.id - a.id);
      return res.end(JSON.stringify(paginator(found, page, clampAll(query.per_page), {
        stats: {
          posted: found.filter((r) => r.status === "posted").length,
          voided: found.filter((r) => r.status === "voided").length,
        },
      })));
    }

    // Served so a per-row request would be COUNTED here, not just 404.
    const detail = path.match(/^\/repayments\/(\d+)$/);
    if (detail) {
      const row = rows.find((r) => r.id === Number(detail[1]));
      res.statusCode = row ? 200 : 404;
      return res.end(JSON.stringify(row ? { data: serialise(row) } : { message: "Not found" }));
    }

    return res.end(JSON.stringify({ data: [], links: {}, meta: { total: 0 } }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  // Set BEFORE importing: the axios client resolves its baseURL at module init.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;

  repaymentService = (await import("./repayment.service")).repaymentService;
  repaymentList = await import("../lib/repayment-list");
  const paginate = await import("../lib/paginate");
  MAX_PER_PAGE = paginate.MAX_PER_PAGE;
  DEFAULT_MAX_PAGES = paginate.DEFAULT_MAX_PAGES;
});

after(() => {
  server?.close();
});

const loanListRequests = (loanId: number) =>
  requests.filter((r) => r.path === `/loans/${loanId}/repayments`);
const detailRequests = () => requests.filter((r) => /^\/repayments\/\d+$/.test(r.path));
const newest = (loanId: number) =>
  rows.filter((r) => r.loan_id === loanId).reduce((a, b) => (b.payment_date > a.payment_date ? b : a));

/** What the loan page does to load its ledger: drain, then read each row. */
const loadLedger = async (loanId: number) =>
  repaymentList.toLoanRepayments(await repaymentService.listAllForLoan(loanId));

// ── The loan ledger ────────────────────────────────────────────────────────

describe("loan ledger — every payment on the loan, not the oldest 15", () => {
  test("REGRESSION: the call the ledger made got the OLDEST 15 of 237", async () => {
    rows = seed();
    const onePage = await repaymentService.list(1);

    assert.equal(onePage.data.length, 15);
    assert.equal(
      onePage.data.some((r) => r.id === newest(1).id),
      false,
      "the loan's latest payment was not on the ledger",
    );
    assert.equal(onePage.meta.total, 237, "and the response said so all along");
  });

  test("REGRESSION: a row's detail is the row — the per-row request bought nothing", async () => {
    rows = seed();
    const listed = (await repaymentService.list(1, { per_page: MAX_PER_PAGE })).data;
    for (const row of listed.slice(0, 5)) {
      assert.deepEqual(await repaymentService.detail(row.id), row);
    }
  });

  test("list() keeps `meta` — getRaw, not get", async () => {
    rows = seed();
    const res = await repaymentService.list(1, { per_page: MAX_PER_PAGE });
    assert.ok(!Array.isArray(res), "api.get would have unwrapped this to a bare array");
    assert.equal(res.meta.last_page, 3);
  });

  test("listAllForLoan drains 237 payments in three requests: 100 + 100 + 37", async () => {
    rows = seed();
    requests = [];

    const { rows: got, total, truncated, pagesFetched } = await repaymentService.listAllForLoan(1);

    assert.equal(got.length, 237);
    assert.equal(total, 237);
    assert.equal(truncated, false);
    assert.equal(pagesFetched, 3);
    assert.deepEqual(loanListRequests(1).map((r) => r.query.page), ["1", "2", "3"]);
    assert.ok(loanListRequests(1).every((r) => Number(r.query.per_page) === MAX_PER_PAGE));
    assert.equal(new Set(got.map((r) => r.id)).size, 237, "no page overlap or gap");
    assert.ok(got.some((r) => r.id === newest(1).id), "the newest payment arrived");
  });

  test("a loan with N payments costs ceil(N / 100) requests — and NO detail request", async () => {
    for (const [loanId, n] of [[3, 3], [2, 40], [SIZED_LOAN, 200], [1, 237]] as const) {
      rows = seed(200);
      requests = [];

      const { rows: ledger } = await loadLedger(loanId);

      assert.equal(ledger.length, n);
      assert.equal(detailRequests().length, 0, `loan of ${n}: not one GET /repayments/{id}`);
      assert.equal(requests.length, Math.ceil(n / MAX_PER_PAGE), `loan of ${n}: ceil(${n} / 100) requests in all`);
      assert.ok(
        ledger.every((r) => typeof r.principal_paid === "number" && r.principal_paid > 0),
        "every row's breakdown read off the row itself",
      );
    }
  });

  test("past the runaway guard the drain says it is short, and the ledger's shortfall quotes the total", async () => {
    const count = 2_037;
    rows = seed(count);
    requests = [];

    const { rows: ledger, shortfall } = await loadLedger(SIZED_LOAN);

    assert.equal(loanListRequests(SIZED_LOAN).length, DEFAULT_MAX_PAGES);
    assert.equal(ledger.length, DEFAULT_MAX_PAGES * MAX_PER_PAGE);
    assert.deepEqual(shortfall, { shown: DEFAULT_MAX_PAGES * MAX_PER_PAGE, total: count });
    assert.equal(detailRequests().length, 0);
  });
});

// ── The member's Payments tab ──────────────────────────────────────────────

describe("member Payments tab — every payment across every loan", () => {
  test("REGRESSION: one default page per loan counted 33 of the member's 280 payments", async () => {
    rows = seed();
    const pages = await Promise.all(
      Object.keys(MEMBER_LOANS).map((loanId) => repaymentService.list(Number(loanId))),
    );
    const counted = pages.reduce((n, p) => n + p.data.length, 0);

    assert.equal(counted, 15 + 15 + 3, "the tab said 33");
    assert.equal(MEMBER_PAYMENTS, 280, "the member had made 280");
  });

  test("one drain with `borrower_id` returns all 280 — and nobody else's — in three requests", async () => {
    rows = seed();
    requests = [];

    const { payments, shortfall } = await repaymentService
      .listAll({ borrower_id: MEMBER })
      .then(repaymentList.toBorrowerPayments);

    assert.equal(payments.length, MEMBER_PAYMENTS, "the tab count is the real count");
    assert.equal(shortfall, null);
    assert.ok(payments.every((p) => p.borrower_id === MEMBER), "no other member's payments");
    assert.ok(payments.some((p) => p.status === "voided"), "voided payments still listed, as the tab expects");

    const listReqs = requests.filter((r) => r.path === "/repayments");
    assert.equal(listReqs.length, Math.ceil(MEMBER_PAYMENTS / MAX_PER_PAGE), "not one request per loan");
    for (const r of listReqs) {
      assert.equal(r.query.borrower_id, String(MEMBER), "the member filter rides on every page");
      assert.equal(Number(r.query.per_page), MAX_PER_PAGE);
    }
    assert.equal(requests.length, listReqs.length, "and nothing else: no per-loan or per-row requests");
  });
});
