/**
 * The two remaining "one page treated as the whole dataset" call sites, pinned.
 *
 * These drive the REAL service functions over REAL HTTP against a stub that
 * mirrors the sibling repo's controllers — `LoanController::index()`,
 * `Loan::scopeForStatus()` and `AuditLogController::index()` — rather than
 * asserting against a hand-written mock of what those services return. That
 * matters here specifically: the whole family of bugs is invisible to
 * TypeScript, because a truncated page and a complete dataset are the same
 * type. Only the wire tells them apart.
 *
 * WHAT THIS PROVES: the client asks the right question, and reads the answer
 * without pretending it is bigger than it is.
 * WHAT IT DOES NOT PROVE: that the real controllers behave as written — there
 * is no database, no Eloquent, no policy layer and no MySQL `like` semantics
 * here. The stub is only as honest as the source it was read from.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

// ── The contract, mirrored from the sibling repo ────────────────────────────

/** Loan::ACTIVE_STATUSES — app/Models/Loan.php:74. Two statuses, not four. */
const ACTIVE_STATUSES = ["released", "ongoing"];

interface Row {
  id: number;
  status: string;
  created_at: string;
  borrower_id?: number;
  [k: string]: unknown;
}

/** Loan::scopeForStatus() — splits on ",", expands `active`, then whereIn. */
function forStatus(rows: Row[], status: string): Row[] {
  const wanted = [
    ...new Set(
      status
        .split(",")
        .map((v) => v.trim())
        .flatMap((v) => (v === "active" ? ACTIVE_STATUSES : [v]))
        .filter((v) => v !== ""),
    ),
  ];
  // `?status=` means "no filter", not "match nothing".
  if (wanted.length === 0) return rows;
  return rows.filter((r) => wanted.includes(r.status));
}

/** The clamp both controllers apply, and neither reports. */
const clampLoan = (raw: string | null) =>
  Math.min(Math.max(Number.parseInt(raw ?? "", 10) || 15, 1), 100);
/** AuditLogController has no `max(…, 1)` — mirrored faithfully, quirk included. */
const clampAudit = (raw: string | null) =>
  Math.min(Number.parseInt(raw ?? "", 10) || 15, 100);

function paginator(rows: Row[], page: number, perPage: number, extra = {}) {
  const lastPage = Math.max(1, Math.ceil(rows.length / perPage));
  const current = Math.max(1, page);
  const slice = rows.slice((current - 1) * perPage, current * perPage);
  return {
    data: slice,
    links: {},
    meta: {
      current_page: current,
      last_page: lastPage,
      per_page: perPage,
      total: rows.length,
      ...extra,
    },
  };
}

// ── Seed: the exact shape that hid a borrower's live debt ───────────────────

const CURRENT_LOAN_ID = 1000;
const BORROWER_ID = 7;
const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString();

const mkLoan = (id: number, status: string, created_at: string): Row => ({
  id,
  status,
  created_at,
  borrower_id: BORROWER_ID,
  principal_amount: 100_000,
  outstanding_balance: status === "completed" ? 0 : 60_000,
});

/**
 * Three genuine obligations, created OLDEST; then 50 `completed` loans; then the
 * application under review, created newest. Sorted newest-first — as the
 * endpoint sorts — the 3 that matter sit at the very bottom of the list.
 */
function seedLoans(): Row[] {
  const loans: Row[] = [
    mkLoan(1, "released", day(1)),
    mkLoan(2, "ongoing", day(2)),
    mkLoan(3, "approved", day(3)),
  ];
  for (let i = 0; i < 50; i++) loans.push(mkLoan(100 + i, "completed", day(100 + i)));
  loans.push(mkLoan(CURRENT_LOAN_ID, "for_review", day(400)));
  // A different borrower, so `borrower_id` scoping is actually exercised.
  for (let i = 0; i < 5; i++) {
    loans.push({ ...mkLoan(2000 + i, "ongoing", day(50 + i)), borrower_id: 99 });
  }
  return loans;
}

/** A borrower with more concurrent obligations than one page can hold. */
function seedManyObligations(count: number): Row[] {
  return Array.from({ length: count }, (_, i) =>
    mkLoan(5000 + i, i % 2 === 0 ? "released" : "ongoing", day(i + 1)),
  );
}

function seedAuditLogs(n: number): Row[] {
  const actions = ["created", "updated", "deleted", "approved", "voided", "rejected"];
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    action: actions[i % actions.length],
    status: "n/a",
    auditable_type: ["App\\Models\\Loan", "App\\Models\\Borrower"][i % 2],
    module: "loans",
    description: `Audit event #${i + 1}`,
    created_at: new Date(Date.UTC(2026, 0, 1) + (i + 1) * 3_600_000).toISOString(),
    user: { id: (i % 4) + 1, full_name: "Ana Cruz", roles: ["loan_officer"] },
  }));
}

// ── Harness ────────────────────────────────────────────────────────────────

const AUDIT_LOG_COUNT = 247;

let server: Server;
let requests: Array<{ path: string; query: Record<string, string> }> = [];
let loanRows = seedLoans();

let loanService: typeof import("./loan.service").loanService;
let auditService: typeof import("./audit.service").auditService;
let BORROWER_OBLIGATION_STATUSES: typeof import("./loan.service").BORROWER_OBLIGATION_STATUSES;
let BORROWER_OBLIGATION_STATUS_PARAM: string;
let MAX_PER_PAGE: number;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname.replace(/^\/api/, "");
    const query = Object.fromEntries(url.searchParams.entries());
    requests.push({ path, query });
    res.setHeader("Content-Type", "application/json");

    if (path === "/loans") {
      let rows = loanRows;
      if (query.borrower_id) {
        rows = rows.filter((l) => String(l.borrower_id) === query.borrower_id);
      }
      if (query.status) rows = forStatus(rows, query.status);
      rows = [...rows].sort(
        (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id,
      );
      return res.end(
        JSON.stringify(
          paginator(rows, Number.parseInt(query.page ?? "1", 10) || 1, clampLoan(query.per_page ?? null)),
        ),
      );
    }

    if (path === "/audit-logs") {
      let rows = seedAuditLogs(AUDIT_LOG_COUNT);
      if (query.action) rows = rows.filter((l) => l.action === query.action);
      rows = [...rows].sort(
        (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id,
      );
      return res.end(
        JSON.stringify(
          paginator(rows, Number.parseInt(query.page ?? "1", 10) || 1, clampAudit(query.per_page ?? null)),
        ),
      );
    }

    if (path === "/audit-logs/export") {
      res.setHeader("Content-Type", "text/csv");
      return res.end("Timestamp,User,Action\n");
    }

    return res.end(JSON.stringify({ data: [], links: {}, meta: { total: 0 } }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  // Set BEFORE importing: axios-client resolves its baseURL at module init, and
  // in Node (no `window`) it reads NEXT_PUBLIC_API_URL directly.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;

  const loanMod = await import("./loan.service");
  const auditMod = await import("./audit.service");
  const paginate = await import("../lib/paginate");
  loanService = loanMod.loanService;
  BORROWER_OBLIGATION_STATUSES = loanMod.BORROWER_OBLIGATION_STATUSES;
  BORROWER_OBLIGATION_STATUS_PARAM = loanMod.BORROWER_OBLIGATION_STATUS_PARAM;
  auditService = auditMod.auditService;
  MAX_PER_PAGE = paginate.MAX_PER_PAGE;
});

after(() => {
  server?.close();
});

// ── The obligations panel ──────────────────────────────────────────────────

describe("borrower obligations (loans/[id] approval screen)", () => {
  test("the status set is a comma STRING, not an array", () => {
    // `index()` validates `'status' => ['nullable','string']`, so axios
    // serialising an array into `status[]=released&…` is a 422 and a blank
    // panel — the same empty list, different cause.
    assert.equal(typeof BORROWER_OBLIGATION_STATUS_PARAM, "string");
    assert.equal(BORROWER_OBLIGATION_STATUS_PARAM, "released,ongoing,for_review,approved");
    assert.ok(
      !/\s/.test(BORROWER_OBLIGATION_STATUS_PARAM),
      "scopeForStatus trims, but whitespace here would still be a silent typo magnet",
    );
  });

  test("is a strict superset of ACTIVE_STATUSES, so `status=active` cannot replace it", () => {
    // The tempting "simplification" this guards against. `active` expands to
    // released+ongoing only: money already out the door. An approver also has
    // to see what is committed (`approved`) and what is queued behind this
    // application (`for_review`).
    for (const s of ACTIVE_STATUSES) {
      assert.ok(BORROWER_OBLIGATION_STATUSES.includes(s as never), `${s} must be included`);
    }
    const extra = BORROWER_OBLIGATION_STATUSES.filter(
      (s) => !ACTIVE_STATUSES.includes(s),
    );
    assert.deepEqual([...extra].sort(), ["approved", "for_review"]);
  });

  test("REGRESSION: 50 newest loans completed, 3 older ones live — approver saw zero", async () => {
    loanRows = seedLoans();

    // ── The call site as it was: one page, then filter what came back. ──
    const oldWay = await loanService.list({ borrower_id: BORROWER_ID, per_page: 50 });
    const oldShown = (oldWay.data ?? []).filter(
      (l) =>
        l.id !== CURRENT_LOAN_ID &&
        ["released", "ongoing", "for_review", "approved"].includes(l.status),
    );
    assert.equal(oldWay.data?.length, 50, "the server did hand back a full page");
    assert.equal(
      oldShown.length,
      0,
      "the bug: a borrower carrying three live loans showed the approver none",
    );

    // ── The call site now: filter on the server, drain what matches. ──
    const { rows, truncated } = await loanService.obligationsForBorrower(BORROWER_ID);
    const shown = rows.filter((l) => l.id !== CURRENT_LOAN_ID);
    assert.equal(truncated, false);
    assert.equal(shown.length, 3);
    assert.deepEqual(
      shown.map((l) => l.status).sort(),
      ["approved", "ongoing", "released"],
    );
  });

  test("the status filter is actually sent to the server", async () => {
    loanRows = seedLoans();
    requests = [];
    await loanService.obligationsForBorrower(BORROWER_ID);

    const loanReqs = requests.filter((r) => r.path === "/loans");
    assert.ok(loanReqs.length > 0);
    for (const r of loanReqs) {
      assert.equal(r.query.status, BORROWER_OBLIGATION_STATUS_PARAM);
      assert.equal(r.query.borrower_id, String(BORROWER_ID));
    }
  });

  test("one page of obligations costs exactly one request", async () => {
    loanRows = seedLoans();
    requests = [];
    await loanService.obligationsForBorrower(BORROWER_ID);
    assert.equal(
      requests.filter((r) => r.path === "/loans").length,
      1,
      "draining a set this small must not cost more than paging it did",
    );
  });

  test("and it still completes when a borrower holds more than one page of them", async () => {
    // The case a page size cannot survive: 150 concurrent obligations. No
    // literal in the client is right here — 50 hid 100 of them, 100 hides 50.
    loanRows = seedManyObligations(150);
    requests = [];

    const { rows, total, truncated } = await loanService.obligationsForBorrower(BORROWER_ID);

    assert.equal(rows.length, 150);
    assert.equal(total, 150);
    assert.equal(truncated, false);
    assert.equal(new Set(rows.map((l) => l.id)).size, 150, "no page overlap or gap");

    const perPages = requests
      .filter((r) => r.path === "/loans")
      .map((r) => Number(r.query.per_page));
    assert.ok(
      perPages.every((p) => p <= MAX_PER_PAGE),
      `never ask past the server's ceiling; asked for ${perPages.join(", ")}`,
    );

    loanRows = seedLoans();
  });
});

// ── The audit trail ────────────────────────────────────────────────────────

describe("audit trail pagination", () => {
  test("list() preserves `meta` — the getRaw fix", async () => {
    // Under `api.get` this returned the bare rows array, so `meta` never
    // reached the page: its `meta` state was permanently null and the
    // "Total Events" card fell back to `logs.length`. The count agreed with
    // the truncated table and both were wrong, with nothing able to say so.
    const res = await auditService.list({ page: 1, per_page: 100 });

    assert.ok(!Array.isArray(res), "getRaw must not unwrap to a bare array");
    assert.equal(res.data.length, 100);
    assert.equal(res.meta?.total, AUDIT_LOG_COUNT);
    assert.equal(res.meta?.last_page, 3);
    assert.equal(res.meta?.current_page, 1);
  });

  test("meta.per_page reports what the server SERVED, not what we asked for", async () => {
    // The paginator divides `total` by this. Trusting the requested number
    // instead is how a page count comes out 100x too small.
    const res = await auditService.list({ page: 1, per_page: 9999 });
    assert.equal(res.meta?.per_page, MAX_PER_PAGE);
    assert.equal(res.data.length, MAX_PER_PAGE);
    assert.equal(res.meta?.total, AUDIT_LOG_COUNT);
  });

  test("pages past the first are reachable, and disjoint", async () => {
    // The 147 rows the screen previously had no way to reach at all.
    const p1 = await auditService.list({ page: 1, per_page: 100 });
    const p2 = await auditService.list({ page: 2, per_page: 100 });
    const p3 = await auditService.list({ page: 3, per_page: 100 });

    assert.equal(p3.data.length, AUDIT_LOG_COUNT - 200);

    const ids = [...p1.data, ...p2.data, ...p3.data].map((l) => l.id);
    assert.equal(ids.length, AUDIT_LOG_COUNT);
    assert.equal(new Set(ids).size, AUDIT_LOG_COUNT, "no row repeated or skipped");
  });

  test("a filter narrows meta.total, so the paginator shrinks with it", async () => {
    const res = await auditService.list({ page: 1, per_page: 25, action: "deleted" });
    const expected = seedAuditLogs(AUDIT_LOG_COUNT).filter((l) => l.action === "deleted").length;
    assert.equal(res.meta?.total, expected);
    assert.ok(expected < AUDIT_LOG_COUNT);
  });

  test("export is not page-scoped — it sends filters and no pagination", async () => {
    requests = [];
    try {
      await auditService.export({ action: "deleted" });
    } catch {
      // `api.download` asks axios for a Blob, which the Node adapter need not
      // support. The assertion is on the request that reached the server.
    }
    const req = requests.find((r) => r.path === "/audit-logs/export");
    assert.ok(req, "export must hit its own endpoint, not the list");
    assert.equal(req.query.action, "deleted", "filters carry over");
    assert.equal(req.query.page, undefined, "no page — the CSV is the whole log");
    assert.equal(req.query.per_page, undefined, "and no page size to clamp");
  });
});
