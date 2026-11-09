/**
 * The accounting service, over real HTTP, against a stub of the contract.
 *
 * Same approach as `list-truncation.test.ts` next door, and for the same
 * reason: every bug pinned here is invisible to TypeScript. A draft line's
 * `debit` is `string` whether it holds "1,500.50" or centavos; a truncated page
 * and a complete dataset are the same type. Only the wire tells them apart, so
 * the assertions are made against the REQUEST THE SERVICE ACTUALLY SENT rather
 * than against a mock of what it was supposed to send.
 *
 * That distinction is the whole point for the journal payload. The entry form's
 * on-screen balance panel was already correct — it read `toCentavos` — and it
 * reported "Balanced, 150050 both sides" for the exact draft that reached the
 * API as raw text. Every assertion that stopped at the component agreed with
 * it. Only the body says otherwise.
 *
 * WHAT THIS PROVES: the client sends whole centavos, sends no blank rows, and
 * reads a paginated list without pretending one page is all of it.
 * WHAT IT DOES NOT PROVE: that the real controllers behave as mirrored — there
 * is no PHP here. `phpFloat` below is a reading of the cast, not the cast.
 */
import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import type { JournalEntryDraft } from "../types/accounting";
import { API_ENDPOINTS } from "../config/api-endpoints";
import type { ListPage } from "./accounting.service";

// ── The contract, mirrored ──────────────────────────────────────────────────

/**
 * PHP's string-to-float cast, which is where the journal bug actually bit.
 *
 * PHP reads a numeric PREFIX and discards the rest without raising anything:
 * `(float)"1,500.50"` stops at the comma and yields `1.0`, while
 * `(float)"1500.50"` yields `1500.5`. Two spellings of the same amount, one of
 * them off by three orders of magnitude, and no error on either side.
 */
function phpFloat(value: unknown): number {
  if (typeof value === "number") return value;
  const match = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/.exec(String(value));
  return match ? Number(match[0]) : 0;
}

/** `paginate(min((int) request('per_page', 15), 100))` — the clamp, and its default. */
const clamp = (raw: string | null) =>
  Math.min(Math.max(Number.parseInt(raw ?? "", 10) || 15, 1), 100);

interface Row {
  id: number;
  [k: string]: unknown;
}

function paginator(rows: Row[], page: number, perPage: number) {
  const lastPage = Math.max(1, Math.ceil(rows.length / perPage));
  const current = Math.max(1, page);
  return {
    data: rows.slice((current - 1) * perPage, current * perPage),
    links: {},
    meta: {
      current_page: current,
      last_page: lastPage,
      per_page: perPage,
      total: rows.length,
    },
  };
}

// ── Seeds ───────────────────────────────────────────────────────────────────

/** More than one page of everything, so a single-page read is always short. */
const ACCOUNT_COUNT = 64;
const JOURNAL_COUNT = 137;
const EXPENSE_COUNT = 40;
const LEDGER_COUNT = 250;
const PERIOD_COUNT = 21;
const CASH_ACCOUNT_COUNT = 18;
const RECONCILIATION_COUNT = 23;
const LOAN_AGING_COUNT = 31;

/**
 * The server's own figures over every matching row, merged into each page's
 * `meta` (round B contracts, brief-b2 to brief-b4). The test reads them back to
 * prove a page call returns `meta` whole rather than the rows alone.
 */
const PAGE_META: Record<string, Record<string, unknown>> = {
  "/accounting/journals": {
    totals: { count: JOURNAL_COUNT, total_debit: 137_000, total_credit: 137_000 },
    stats: { draft: 2, posted: 130, reversed: 5 },
  },
  "/accounting/general-ledger": {
    opening_balance: 50_000,
    closing_balance: 75_000,
    total_debit: 40_000,
    total_credit: 15_000,
  },
  "/accounting/expenses": {
    totals: { count: EXPENSE_COUNT, amount: 4_000_000, amount_paid: 0, amount_due: 4_000_000 },
    stats: { unpaid: 40, partially_paid: 0, paid: 0, overdue: 0 },
  },
  "/accounting/cash-accounts": {
    totals: {
      balance: 4_500_000,
      by_kind: { cash: 1_000_000, bank: 3_000_000, gcash: 500_000, maya: 0, wallet: 0 },
    },
  },
  "/accounting/loan-accounting/loans": {
    totals: {
      count: LOAN_AGING_COUNT,
      outstanding_principal: 3_100_000,
      total_outstanding: 3_400_000,
      past_due_amount: 120_000,
    },
    stats: { current: 0, "1_30": 31, "31_60": 0, "61_90": 0, "91_120": 0, over_120: 0 },
  },
};

/** Whole documents, answered as `{data}` and unwrapped by `api.get`. */
const DOCUMENTS: Record<string, Record<string, unknown>> = {
  "/accounting/statements/balance-sheet": { as_of: "2026-11-09", is_balanced: true },
  "/accounting/statements/income-statement": { net_income: -2_500 },
  "/accounting/loan-accounting/summary": { as_of: "2026-11-09" },
  "/accounting/books/cash-receipts/columns": { kind: "cash_receipts", is_balanced: true },
  "/accounting/books/cash-disbursements/columns": {
    kind: "cash_disbursements",
    is_balanced: true,
  },
  "/accounting/journals/9": { id: 9, journal_no: "JE-000009" },
  "/accounting/expenses/4": { id: 4, amount_due: 25_000 },
  "/accounting/accounts/12": { id: 12, code: "1010" },
};

const JOURNAL_PREVIEW = {
  total_debit: 150_050,
  total_credit: 100_000,
  difference: 50_050,
  out_by: 50_050,
  heavier_side: "debit",
  is_balanced: false,
  line_count: 2,
};

const seedRows = (n: number, make: (i: number) => Record<string, unknown>): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, ...make(i) }));

/** 40 open payables of ₱1,000.00 each — the "Outstanding" headline's input. */
const expenseRows = () =>
  seedRows(EXPENSE_COUNT, () => ({
    amount: 100_000,
    amount_paid: 0,
    status: "unpaid",
  }));

// ── Harness ─────────────────────────────────────────────────────────────────

interface Recorded {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
}

let server: Server;
let requests: Recorded[] = [];
let accountingService: typeof import("./accounting.service").accountingService;
let MAX_PER_PAGE: number;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname.replace(/^\/api/, "");
    const query = Object.fromEntries(url.searchParams.entries());

    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      let body: unknown = null;
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          body = raw;
        }
      }
      requests.push({ method: req.method ?? "GET", path, query, body });
      res.setHeader("Content-Type", "application/json");

      const page = Number.parseInt(query.page ?? "1", 10) || 1;
      const perPage = clamp(query.per_page ?? null);

      const lists: Record<string, () => Row[]> = {
        "/accounting/accounts": () =>
          seedRows(ACCOUNT_COUNT, (i) => ({
            code: String(1000 + i),
            name: `Account ${i + 1}`,
            is_active: true,
            is_group: false,
          })),
        "/accounting/journals": () =>
          seedRows(JOURNAL_COUNT, () => ({ total_debit: 1000, total_credit: 1000 })),
        "/accounting/general-ledger": () =>
          // running_balance climbs by 100 a row, so a short read is detectable
          // as a WRONG BALANCE rather than merely as missing rows.
          seedRows(LEDGER_COUNT, (i) => ({ running_balance: (i + 1) * 100 })),
        "/accounting/expenses": expenseRows,
        "/accounting/cash-accounts": () =>
          seedRows(CASH_ACCOUNT_COUNT, () => ({ balance: 250_000 })),
        "/accounting/reconciliations": () =>
          seedRows(RECONCILIATION_COUNT, () => ({ account_id: 1 })),
        "/accounting/periods": () => seedRows(PERIOD_COUNT, () => ({ status: "open" })),
        "/accounting/loan-accounting/loans": () =>
          seedRows(LOAN_AGING_COUNT, (i) => ({ loan_id: i + 1, bucket: "1_30" })),
      };

      if (req.method === "GET" && lists[path]) {
        const pageBody = paginator(lists[path](), page, perPage);
        return res.end(
          JSON.stringify({ ...pageBody, meta: { ...pageBody.meta, ...PAGE_META[path] } }),
        );
      }

      if (req.method === "GET" && DOCUMENTS[path]) {
        // A whole document in `{data}`, as the statements and books answer.
        return res.end(JSON.stringify({ data: DOCUMENTS[path] }));
      }

      if (req.method === "POST" && path === "/accounting/journals") {
        // The envelope `api.post` unwraps. Echo the body so a test can assert
        // what the SERVER received rather than what the client meant to send.
        return res.end(
          JSON.stringify({ success: true, data: { id: 1, ...(body as object) } }),
        );
      }

      if (req.method === "POST" && path === "/accounting/journals/preview") {
        return res.end(JSON.stringify({ data: JOURNAL_PREVIEW }));
      }

      if (req.method === "PUT" || req.method === "POST") {
        return res.end(JSON.stringify({ success: true, data: { id: 1, ...(body as object) } }));
      }

      return res.end(JSON.stringify({ data: [], links: {}, meta: { total: 0 } }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  // Set BEFORE importing: axios-client resolves its baseURL at module init.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;

  accountingService = (await import("./accounting.service")).accountingService;
  MAX_PER_PAGE = (await import("../lib/paginate")).MAX_PER_PAGE;
});

after(() => {
  server?.close();
});

beforeEach(() => {
  requests = [];
});

const lastBody = () => requests[requests.length - 1].body as Record<string, unknown>;
type WireLine = { account_id: number; debit: number; credit: number };
const bodyLines = () => lastBody().lines as WireLine[];

/**
 * Rows out of a SINGLE page, whatever shape it arrived in.
 *
 * `ListPage<T>` is a union — paginator, bare envelope, or bare array — because
 * the endpoint may answer any of the three and flattening that was the old
 * `unwrapList`'s mistake. Narrowing it here rather than casting keeps the test
 * honest about which shape it is reading.
 */
function rowsOf<T>(page: ListPage<T>): T[] {
  return Array.isArray(page) ? page : (page.data as T[]);
}

// ── 1. The journal payload ──────────────────────────────────────────────────

describe("createJournal sends centavos, not the characters someone typed", () => {
  /**
   * The captured draft, exactly: one side typed with a thousands separator and
   * one without, plus the spare row the form always keeps on screen. The
   * on-screen panel called this "Balanced, 150050 both sides".
   */
  const capturedDraft = (): JournalEntryDraft => ({
    date: "2026-09-15",
    reference: "",
    branch_id: null,
    description: "Manual adjustment",
    lines: [
      { account_id: 2, description: "", debit: "1,500.50", credit: "" },
      { account_id: 33, description: "", debit: "", credit: "1500.50" },
      { account_id: null, description: "", debit: "", credit: "" },
    ],
  });

  test("REGRESSION: the request body the ledger used to receive was unbalanced", () => {
    // What `api.post(…, draft)` put on the wire before the fix, and what PHP
    // made of it. This is the defect, stated as the arithmetic the backend
    // would have done — not a claim about the client.
    const asSent = capturedDraft().lines;
    const debit = phpFloat(asSent[0].debit);
    const credit = phpFloat(asSent[1].credit);

    assert.equal(debit, 1, "(float)\"1,500.50\" stops at the comma");
    assert.equal(credit, 1500.5, "(float)\"1500.50\" does not");
    assert.notEqual(
      debit,
      credit,
      "an entry the form had just declared balanced, out by ₱1,499.50 on arrival",
    );
  });

  test("both spellings of ₱1,500.50 arrive as the same integer, 150050", async () => {
    await accountingService.createJournal(capturedDraft());

    const lines = bodyLines();
    assert.equal(lines[0].debit, 150050);
    assert.equal(lines[1].credit, 150050);
    // The grouped and ungrouped spellings must be indistinguishable on the wire.
    assert.equal(lines[0].debit, lines[1].credit);
  });

  test("every amount on the wire is an integer — no strings, no decimals", async () => {
    await accountingService.createJournal(capturedDraft());

    for (const line of bodyLines()) {
      for (const side of ["debit", "credit"] as const) {
        assert.equal(
          typeof line[side],
          "number",
          `${side} must not reach the API as text`,
        );
        assert.ok(
          Number.isInteger(line[side]),
          `${side} must be whole centavos, got ${line[side]}`,
        );
      }
    }
  });

  test("the sent body survives PHP's cast unchanged, and still balances", async () => {
    await accountingService.createJournal(capturedDraft());

    const lines = bodyLines();
    const debit = lines.reduce((t, l) => t + phpFloat(l.debit), 0);
    const credit = lines.reduce((t, l) => t + phpFloat(l.credit), 0);

    assert.equal(debit, 150050);
    assert.equal(credit, 150050);
    assert.equal(debit, credit, "the point of the whole exercise");
  });

  test("the blank spare row is dropped rather than shipped", async () => {
    await accountingService.createJournal(capturedDraft());

    const lines = bodyLines();
    assert.equal(lines.length, 2, "three rows on screen, two of them real");
    assert.ok(
      lines.every((l) => l.account_id !== null),
      "a line with no account must never reach the API",
    );
  });

  test("no totals travel with the lines: the server works them out", async () => {
    await accountingService.createJournal(capturedDraft());

    const body = lastBody();
    assert.equal("total_debit" in body, false);
    assert.equal("total_credit" in body, false);
    assert.equal(body.source, "manual");
    // "" is the form's empty reference; the API's empty is null.
    assert.equal(body.reference, null);
  });

  test("a peso sign and stray spacing are resolved here, not by PHP", async () => {
    const draft = capturedDraft();
    draft.lines[0].debit = " ₱ 1 500.50 ";
    await accountingService.createJournal(draft);

    assert.equal(bodyLines()[0].debit, 150050);
  });

  test("an unbalanced draft is sent as typed: the balance is the server's to judge", async () => {
    // The form refuses it first, from the server's preview; posting refuses it
    // again on the server. The browser never totals the lines.
    const draft = capturedDraft();
    draft.lines[1].credit = "1400.50";

    await accountingService.createJournal(draft);
    assert.equal(bodyLines()[1].credit, 140050);
  });

  test("an amount that is not an amount is refused, with the text quoted back", async () => {
    const draft = capturedDraft();
    draft.lines[0].debit = "one thousand";

    await assert.rejects(
      () => accountingService.createJournal(draft),
      /one thousand/,
    );
    assert.equal(requests.length, 0);
  });

  test("a negative debit is refused rather than silently flipped", async () => {
    // Direction belongs to the column, not the sign — accepting "-100" as a
    // debit would let two visually different entries post the same numbers.
    const draft = capturedDraft();
    draft.lines[0].debit = "-1500.50";

    await assert.rejects(() => accountingService.createJournal(draft));
    assert.equal(requests.length, 0);
  });
});

// ── 2. Pagination ───────────────────────────────────────────────────────────

describe("lists are drained, not read one page deep", () => {
  test("REGRESSION: a bare single-page call returns the default 15", async () => {
    // The shape all seven call sites had. Kept as a test because it is the
    // thing the lint rule now flags, and because it is what "looked finished".
    //
    // Disabled at the line, not for test files as a whole: a test proving a
    // bare call reads one page has to be able to write one, but every OTHER
    // test file should still be guarded. The sibling `no-oversized-per-page`
    // is switched off for all tests in eslint.config.mjs only because it is an
    // ERROR and would break the build; this one is advisory, so the narrower
    // exemption is available and the noise is confined to the two lines that
    // are deliberately wrong.
    // eslint-disable-next-line pagination/no-unparameterised-list -- the defect, on purpose
    const rows = rowsOf(await accountingService.accountsList());

    assert.equal(rows.length, 15, "the endpoint's default, not the chart");
    assert.ok(ACCOUNT_COUNT > 15, "and the chart is bigger than that");
  });

  test("the drain asks for the documented ceiling, never a guess above it", async () => {
    await accountingService.accountsListAll();

    assert.ok(requests.length > 0);
    for (const req of requests) {
      assert.equal(req.query.per_page, String(MAX_PER_PAGE));
      assert.ok(Number(req.query.per_page) <= 100, "above 100 is clamped in silence");
    }
  });

  test("the whole chart of accounts arrives, across pages", async () => {
    const { rows, total, truncated } = await accountingService.accountsListAll();

    assert.equal(rows.length, ACCOUNT_COUNT);
    assert.equal(total, ACCOUNT_COUNT);
    assert.equal(truncated, false);
    assert.equal(requests.length, 1, "64 rows fit in one page of 100");
  });

  test("REGRESSION: Outstanding was the total of the first 15 of 40 payables", async () => {
    // eslint-disable-next-line pagination/no-unparameterised-list -- the defect, on purpose
    const short = rowsOf(await accountingService.expensesList());
    const shortTotal = short.reduce((t, r) => t + r.amount - r.amount_paid, 0);

    const { rows } = await accountingService.expensesListAll();
    const wholeTotal = rows.reduce((t, r) => t + r.amount - r.amount_paid, 0);

    assert.equal(shortTotal, 15 * 100_000, "₱15,000.00 — the headline that shipped");
    assert.equal(wholeTotal, EXPENSE_COUNT * 100_000, "₱40,000.00 — what is owed");
    assert.ok(wholeTotal > shortTotal, "and the screen said nothing about the gap");
  });

  test("every remaining list drains too", async () => {
    const cases: Array<[string, () => Promise<{ rows: unknown[] }>, number]> = [
      ["cash accounts", () => accountingService.cashAccountsListAll(), CASH_ACCOUNT_COUNT],
      [
        "reconciliations",
        () => accountingService.reconciliationsListAll(),
        RECONCILIATION_COUNT,
      ],
      ["periods", () => accountingService.periodsListAll(), PERIOD_COUNT],
    ];

    for (const [name, call, expected] of cases) {
      const { rows } = await call();
      assert.equal(rows.length, expected, `${name} must arrive whole`);
      assert.ok(expected > 15, `${name}: the seed must exceed one default page`);
    }
  });

  test("a drain that gives up says so instead of returning a short list", async () => {
    // The runaway guard, reached by capping pages below what the data needs.
    const { fetchAllPages } = await import("../lib/paginate");
    const drain = await fetchAllPages<Row>(
      ({ page, per_page }) =>
        accountingService.generalLedgerList({ account_id: 1, page, per_page }),
      { perPage: 10, maxPages: 2 },
    );

    assert.equal(drain.truncated, true, "incomplete, and admits it");
    assert.equal(drain.rows.length, 20);
    assert.equal(drain.total, LEDGER_COUNT, "and still knows how many exist");
  });
});

// ── 3. Round B contracts: endpoints, documents and pages ────────────────────

/** The one request a call made. Every call below makes exactly one. */
function onlyRequest(): Recorded {
  assert.equal(requests.length, 1, "one call, one request");
  return requests[0];
}

describe("round B endpoints", () => {
  test("the new paths match the backend contracts", () => {
    const A = API_ENDPOINTS.ACCOUNTING;
    assert.equal(A.BALANCE_SHEET, "/accounting/statements/balance-sheet");
    assert.equal(A.INCOME_STATEMENT, "/accounting/statements/income-statement");
    assert.equal(A.LOAN_ACCOUNTING_SUMMARY, "/accounting/loan-accounting/summary");
    assert.equal(A.LOAN_ACCOUNTING_LOANS, "/accounting/loan-accounting/loans");
    assert.equal(A.JOURNALS_PREVIEW, "/accounting/journals/preview");
    assert.equal(A.ACCOUNTS_CREATE, "/accounting/accounts");
    assert.deepEqual(A.BOOK_COLUMNS, {
      cash_receipts: "/accounting/books/cash-receipts/columns",
      cash_disbursements: "/accounting/books/cash-disbursements/columns",
    });
    assert.equal(A.RECONCILIATIONS_CREATE, "/accounting/reconciliations");
  });

  test("each id helper puts the id in the path", () => {
    const A = API_ENDPOINTS.ACCOUNTING;
    assert.equal(A.JOURNALS_SHOW(9), "/accounting/journals/9");
    assert.equal(A.JOURNALS_UPDATE(9), "/accounting/journals/9");
    assert.equal(A.ACCOUNTS_SHOW(12), "/accounting/accounts/12");
    assert.equal(A.ACCOUNTS_UPDATE(12), "/accounting/accounts/12");
    assert.equal(A.ACCOUNTS_DELETE(12), "/accounting/accounts/12");
    assert.equal(A.EXPENSES_SHOW(4), "/accounting/expenses/4");
    assert.equal(A.EXPENSES_UPDATE(4), "/accounting/expenses/4");
    assert.equal(A.EXPENSES_PAY(4), "/accounting/expenses/4/pay");
    assert.equal(A.RECONCILIATIONS_SHOW(3), "/accounting/reconciliations/3");
    assert.equal(A.RECONCILIATIONS_MATCH(3), "/accounting/reconciliations/3/match");
  });
});

describe("round B statements and summaries are whole documents", () => {
  test("balanceSheet sends as_of and the branch, and unwraps data", async () => {
    const sheet = await accountingService.balanceSheet("2026-11-09", 3);
    const req = onlyRequest();
    assert.equal(req.method, "GET");
    assert.equal(req.path, "/accounting/statements/balance-sheet");
    assert.deepEqual(req.query, { as_of: "2026-11-09", branch_id: "3" });
    assert.equal(sheet.is_balanced, true);
  });

  test("balanceSheet without a branch sends no branch_id", async () => {
    await accountingService.balanceSheet("2026-11-09");
    assert.deepEqual(onlyRequest().query, { as_of: "2026-11-09" });
  });

  test("incomeStatement sends from, to and the branch", async () => {
    const statement = await accountingService.incomeStatement({
      from: "2026-01-01",
      to: "2026-11-09",
      branch_id: 2,
    });
    const req = onlyRequest();
    assert.equal(req.path, "/accounting/statements/income-statement");
    assert.deepEqual(req.query, { from: "2026-01-01", to: "2026-11-09", branch_id: "2" });
    assert.equal(statement.net_income, -2_500, "a loss arrives negative, as sent");
  });

  test("dashboard gains from; the old two-argument call sends none", async () => {
    await accountingService.dashboard("2026-11-09", 3, "2026-10-01");
    assert.deepEqual(onlyRequest().query, {
      as_of: "2026-11-09",
      branch_id: "3",
      from: "2026-10-01",
    });

    requests = [];
    await accountingService.dashboard("2026-11-09");
    assert.deepEqual(onlyRequest().query, { as_of: "2026-11-09" });
  });

  test("loanAccountingSummary sends as_of and the branch", async () => {
    const summary = await accountingService.loanAccountingSummary("2026-11-09", 5);
    const req = onlyRequest();
    assert.equal(req.path, "/accounting/loan-accounting/summary");
    assert.deepEqual(req.query, { as_of: "2026-11-09", branch_id: "5" });
    assert.equal(summary.as_of, "2026-11-09");
  });

  test("columnBook reads each kind's columns path with the period", async () => {
    for (const kind of ["cash_receipts", "cash_disbursements"] as const) {
      requests = [];
      const book = await accountingService.columnBook(kind, {
        from: "2026-10-01",
        to: "2026-10-31",
        branch_id: 1,
      });
      const req = onlyRequest();
      assert.equal(req.path, API_ENDPOINTS.ACCOUNTING.BOOK_COLUMNS[kind]);
      assert.deepEqual(req.query, { from: "2026-10-01", to: "2026-10-31", branch_id: "1" });
      assert.equal(book.kind, kind);
    }
  });

  test("journal, expense and account read one record by id", async () => {
    assert.equal((await accountingService.journal(9)).journal_no, "JE-000009");
    assert.equal(onlyRequest().path, "/accounting/journals/9");

    requests = [];
    assert.equal((await accountingService.expense(4)).amount_due, 25_000);
    assert.equal(onlyRequest().path, "/accounting/expenses/4");

    requests = [];
    assert.equal((await accountingService.account(12)).code, "1010");
    assert.equal(onlyRequest().path, "/accounting/accounts/12");
  });
});

describe("round B pages keep their meta", () => {
  test("journalsPage sends search and paging, and returns totals and stats", async () => {
    const page = await accountingService.journalsPage({
      search: "JE-0001",
      status: "posted",
      page: 2,
      per_page: 25,
    });
    const req = onlyRequest();
    assert.equal(req.path, "/accounting/journals");
    assert.deepEqual(req.query, { search: "JE-0001", status: "posted", page: "2", per_page: "25" });
    assert.equal(page.data.length, 25);
    assert.deepEqual(page.meta.totals, PAGE_META["/accounting/journals"].totals);
    assert.deepEqual(page.meta.stats, PAGE_META["/accounting/journals"].stats);
    assert.equal(page.meta.total, JOURNAL_COUNT);
  });

  test("generalLedgerPage sends source, and returns the opening and closing balances", async () => {
    const page = await accountingService.generalLedgerPage({
      account_id: 7,
      from: "2026-01-01",
      to: "2026-11-09",
      source: "loan_collection",
      page: 1,
      per_page: 25,
    });
    const req = onlyRequest();
    assert.equal(req.path, "/accounting/general-ledger");
    assert.deepEqual(req.query, {
      account_id: "7",
      from: "2026-01-01",
      to: "2026-11-09",
      source: "loan_collection",
      page: "1",
      per_page: "25",
    });
    assert.equal(page.meta.opening_balance, 50_000);
    assert.equal(page.meta.closing_balance, 75_000);
    assert.equal(page.meta.total_debit, 40_000);
    assert.equal(page.meta.total_credit, 15_000);
  });

  test("expensesPage sends status and search, and returns totals with amount_due", async () => {
    const page = await accountingService.expensesPage({
      status: "unpaid",
      search: "Meralco",
      per_page: 25,
    });
    const req = onlyRequest();
    assert.equal(req.path, "/accounting/expenses");
    assert.deepEqual(req.query, { status: "unpaid", search: "Meralco", per_page: "25" });
    assert.equal(page.meta.totals.amount_due, 4_000_000);
    assert.equal(page.meta.stats.unpaid, 40);
  });

  test("cashAccountsPage returns the balance over every money account, by kind", async () => {
    const page = await accountingService.cashAccountsPage({ branch_id: 2, per_page: 25 });
    const req = onlyRequest();
    assert.equal(req.path, "/accounting/cash-accounts");
    assert.deepEqual(req.query, { branch_id: "2", per_page: "25" });
    assert.equal(page.meta.totals.balance, 4_500_000);
    assert.equal(page.meta.totals.by_kind.bank, 3_000_000);
  });

  test("loanAccountingLoans sends every filter, and returns totals and bucket stats", async () => {
    const page = await accountingService.loanAccountingLoans({
      as_of: "2026-11-09",
      branch_id: 1,
      bucket: "1_30",
      past_due_only: true,
      search: "LN-0001",
      group: "member",
      page: 1,
      per_page: 25,
    });
    const req = onlyRequest();
    assert.equal(req.path, "/accounting/loan-accounting/loans");
    assert.deepEqual(req.query, {
      as_of: "2026-11-09",
      branch_id: "1",
      bucket: "1_30",
      past_due_only: "1",
      search: "LN-0001",
      group: "member",
      page: "1",
      per_page: "25",
    });
    assert.equal(page.meta.totals.count, LOAN_AGING_COUNT);
    assert.equal(page.meta.stats["1_30"], 31);
  });

  test("loanAccountingLoans leaves past_due_only out when it is off", async () => {
    await accountingService.loanAccountingLoans({ as_of: "2026-11-09", past_due_only: false });
    assert.deepEqual(onlyRequest().query, { as_of: "2026-11-09" });
  });
});

describe("round B writes", () => {
  const draft = (): JournalEntryDraft => ({
    date: "2026-11-09",
    reference: "",
    branch_id: null,
    description: "Corrected draft",
    lines: [
      { account_id: 2, description: "", debit: "1,500.50", credit: "" },
      { account_id: 33, description: "", debit: "", credit: "1500.50" },
      { account_id: null, description: "", debit: "", credit: "" },
    ],
  });

  test("updateJournal PUTs centavos through buildJournalPayload, as createJournal does", async () => {
    await accountingService.updateJournal(9, draft());
    const req = onlyRequest();
    assert.equal(req.method, "PUT");
    assert.equal(req.path, "/accounting/journals/9");
    const lines = (req.body as { lines: WireLine[] }).lines;
    assert.equal(lines.length, 2, "the blank spare row is dropped");
    assert.equal(lines[0].debit, 150_050);
    assert.equal(lines[1].credit, 150_050);
  });

  test("updateJournal refuses a malformed draft before sending anything", async () => {
    // The balance is the server's (the form checks it with the preview), but a
    // line that isn't an amount still never leaves the browser.
    const bad = draft();
    bad.lines[1].credit = "one thousand";
    await assert.rejects(accountingService.updateJournal(9, bad));
    assert.equal(requests.length, 0);
  });

  test("previewJournal sends only the lines and returns the server's figures", async () => {
    const preview = await accountingService.previewJournal([
      { account_id: 2, debit: 150_050, credit: 0 },
      { account_id: null, debit: 0, credit: 100_000 },
    ]);
    const req = onlyRequest();
    assert.equal(req.method, "POST");
    assert.equal(req.path, "/accounting/journals/preview");
    assert.deepEqual(req.body, {
      lines: [
        { account_id: 2, debit: 150_050, credit: 0 },
        { account_id: null, debit: 0, credit: 100_000 },
      ],
    });
    assert.deepEqual(preview, JOURNAL_PREVIEW);
  });

  test("updateExpense PUTs to the expense", async () => {
    await accountingService.updateExpense(4, { payee: "Meralco" });
    const req = onlyRequest();
    assert.equal(req.method, "PUT");
    assert.equal(req.path, "/accounting/expenses/4");
    assert.deepEqual(req.body, { payee: "Meralco" });
  });

  test("payExpense POSTs the date, centavos and the paying account", async () => {
    await accountingService.payExpense(4, { date: "2026-11-09", amount: 25_000, account_id: 12 });
    const req = onlyRequest();
    assert.equal(req.method, "POST");
    assert.equal(req.path, "/accounting/expenses/4/pay");
    assert.deepEqual(req.body, { date: "2026-11-09", amount: 25_000, account_id: 12 });
  });

  test("createAccount, updateAccount and deleteAccount use the account paths", async () => {
    await accountingService.createAccount({ code: "1015", name: "Petty Cash" });
    let req = onlyRequest();
    assert.equal(req.method, "POST");
    assert.equal(req.path, "/accounting/accounts");
    assert.deepEqual(req.body, { code: "1015", name: "Petty Cash" });

    requests = [];
    await accountingService.updateAccount(12, { name: "Cash on Hand - Main" });
    req = onlyRequest();
    assert.equal(req.method, "PUT");
    assert.equal(req.path, "/accounting/accounts/12");
    assert.deepEqual(req.body, { name: "Cash on Hand - Main" });

    requests = [];
    await accountingService.deleteAccount(12);
    req = onlyRequest();
    assert.equal(req.method, "DELETE");
    assert.equal(req.path, "/accounting/accounts/12");
  });
});
