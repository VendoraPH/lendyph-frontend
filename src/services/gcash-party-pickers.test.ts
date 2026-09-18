/**
 * The two lists behind the "New Transaction" pickers, driven over REAL HTTP
 * against a stub that mirrors the sibling repo's controllers —
 * `BorrowerController::index()` and `GCashNonMemberController::index()`.
 *
 * A picker is where this family of bug hurts most. Everywhere else a short list
 * looks short; in a picker a missing row is indistinguishable from a person who
 * was never registered, because the control's own answer is "No member found."
 * TypeScript cannot see the difference — one page and the whole membership are
 * the same type — so the assertion has to be made on the wire.
 *
 * WHAT THIS PROVES: the client asks for every page, never asks past the
 * server's ceiling, and carries the filter on each request.
 * WHAT IT DOES NOT PROVE: that the real controllers behave as written. There is
 * no database and no policy layer here; the stub is only as honest as the
 * source it was read from.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

// ── The contract, mirrored from the sibling repo ────────────────────────────

/** BorrowerController::index() — `min((int) per_page ?: 15, 100)`. */
const clampBorrower = (raw: string | null) =>
  Math.min(Number.parseInt(raw ?? "", 10) || 15, 100);
/** GCashNonMemberController::index() — same clamp, default 25. */
const clampNonMember = (raw: string | null) =>
  Math.min(Number.parseInt(raw ?? "", 10) || 25, 100);

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

// ── Seed: a co-op big enough for the bug to bite ────────────────────────────

const MEMBER_COUNT = 300;
const NON_MEMBER_COUNT = 143;
/** The registered member a teller could not find. Deep in the alphabet. */
const NEEDLE = "Maria Dela Cruz";

/** Surnames ordered so the needle sorts past any first page anyone would ask for. */
function seedMembers(): Row[] {
  const rows: Row[] = Array.from({ length: MEMBER_COUNT }, (_, i) => ({
    id: i + 1,
    borrower_code: `M-${String(i + 1).padStart(4, "0")}`,
    full_name: `Ana Abad ${i + 1}`,
    contact_number: "09170000000",
    // Pending and rejected applicants exist in the same table and must not
    // reach a picker whose every row records money.
    status: i % 10 === 0 ? "pending" : "active",
  }));
  rows[250] = {
    id: 251,
    borrower_code: "M-0251",
    full_name: NEEDLE,
    contact_number: "09171234567",
    status: "active",
  };
  return rows;
}

function seedNonMembers(): Row[] {
  return Array.from({ length: NON_MEMBER_COUNT }, (_, i) => ({
    id: i + 1,
    full_name: `Walk-in ${i + 1}`,
    mobile_number: `0998${String(i).padStart(7, "0")}`,
    id_type: "UMID",
    id_number: `UM-${i + 1}`,
  }));
}

// ── Harness ────────────────────────────────────────────────────────────────

let server: Server;
let requests: Array<{ path: string; query: Record<string, string> }> = [];

let borrowerService: typeof import("./borrower.service").borrowerService;
let gcashService: typeof import("./gcash.service").gcashService;
let MAX_PER_PAGE: number;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname.replace(/^\/api/, "");
    const query = Object.fromEntries(url.searchParams.entries());
    requests.push({ path, query });
    res.setHeader("Content-Type", "application/json");
    const page = Number.parseInt(query.page ?? "1", 10) || 1;

    if (path === "/borrowers") {
      let rows = seedMembers();
      // members_only — the filter the tab and the picker both depend on.
      if (query.members_only) rows = rows.filter((r) => r.status === "active");
      if (query.search) {
        const needle = String(query.search).toLowerCase();
        rows = rows.filter((r) =>
          String(r.full_name).toLowerCase().includes(needle),
        );
      }
      return res.end(
        JSON.stringify(paginator(rows, page, clampBorrower(query.per_page ?? null))),
      );
    }

    if (path === "/gcash/non-members") {
      let rows = seedNonMembers();
      if (query.search) {
        const needle = String(query.search).toLowerCase();
        rows = rows.filter((r) =>
          String(r.full_name).toLowerCase().includes(needle),
        );
      }
      return res.end(
        JSON.stringify(paginator(rows, page, clampNonMember(query.per_page ?? null))),
      );
    }

    return res.end(JSON.stringify({ data: [], links: {}, meta: { total: 0 } }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  // Set BEFORE importing: the axios client resolves its baseURL at module init.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;

  borrowerService = (await import("./borrower.service")).borrowerService;
  gcashService = (await import("./gcash.service")).gcashService;
  MAX_PER_PAGE = (await import("../lib/paginate")).MAX_PER_PAGE;
});

after(() => {
  server?.close();
});

// ── The member picker ──────────────────────────────────────────────────────

describe("GCash New Transaction — member picker", () => {
  test("REGRESSION: one 25-row page cannot find member #251, and says she is not there", async () => {
    // The dialog was handed the Members tab's current page and rendered it into
    // a cmdk Command. cmdk filters over the items that are RENDERED, and the
    // dialog's own CommandInput was wired to nothing — so typing a name only
    // ever searched those 25 rows. The control answers "No member found.",
    // which a teller reads as "she is not registered".
    const onePage = await borrowerService.list({ members_only: 1, per_page: 25 });
    assert.equal(onePage.data.length, 25);
    assert.equal(
      onePage.data.some((b) => b.full_name === NEEDLE),
      false,
      "the bug: a registered member is simply not among the rows the picker can search",
    );
    assert.ok(
      (onePage.meta?.total ?? 0) > 25,
      "and the response said so all along — nothing read meta.total",
    );
  });

  test("the drain finds her, because it asks for every page", async () => {
    const { rows, total, truncated } = await borrowerService.listAll({
      members_only: 1,
    });
    assert.equal(truncated, false);
    assert.equal(rows.filter((b) => b.full_name === NEEDLE).length, 1);
    assert.equal(rows.length, total);
    assert.equal(new Set(rows.map((b) => b.id)).size, rows.length, "no page overlap or gap");
  });

  test("members_only rides on every page, not just the first", async () => {
    requests = [];
    const { rows } = await borrowerService.listAll({ members_only: 1 });
    const reqs = requests.filter((r) => r.path === "/borrowers");
    assert.ok(reqs.length > 1, "a 300-member co-op must cost more than one request");
    for (const r of reqs) assert.equal(r.query.members_only, "1");
    assert.equal(
      rows.some((b) => (b as unknown as Row).status === "pending"),
      false,
      "a pending applicant must not be selectable — every row here books money",
    );
  });

  test("never asks past the server's ceiling, because asking is not receiving", async () => {
    requests = [];
    await borrowerService.listAll({ members_only: 1 });
    const perPages = requests
      .filter((r) => r.path === "/borrowers")
      .map((r) => Number(r.query.per_page));
    assert.ok(perPages.length > 0);
    assert.ok(
      perPages.every((p) => p <= MAX_PER_PAGE),
      `per_page must stay within ${MAX_PER_PAGE}; asked for ${perPages.join(", ")}`,
    );
  });

  test("per_page: 9999 is answered with 100 and no complaint — the trap itself", async () => {
    const res = await borrowerService.list({ members_only: 1, per_page: 100 });
    assert.equal(res.data.length, MAX_PER_PAGE);
    const greedy = await borrowerService.list({ members_only: 1, per_page: 9999 });
    assert.equal(greedy.data.length, MAX_PER_PAGE);
    assert.equal(greedy.meta?.per_page, MAX_PER_PAGE, "the clamp is only visible in meta");
  });
});

// ── The walk-in picker ─────────────────────────────────────────────────────

describe("GCash New Transaction — walk-in picker", () => {
  test("listAllNonMembers drains past the same silent clamp", async () => {
    requests = [];
    const { rows, total, truncated } = await gcashService.listAllNonMembers();

    assert.equal(truncated, false);
    assert.equal(rows.length, NON_MEMBER_COUNT);
    assert.equal(total, NON_MEMBER_COUNT);
    assert.equal(new Set(rows.map((n) => n.id)).size, NON_MEMBER_COUNT);

    const perPages = requests
      .filter((r) => r.path === "/gcash/non-members")
      .map((r) => Number(r.query.per_page));
    assert.ok(perPages.every((p) => p <= MAX_PER_PAGE));
    assert.ok(
      rows.some((n) => n.id === NON_MEMBER_COUNT),
      "walk-in #143 lives past page one and must still be selectable",
    );
  });

  test("it returns a DrainResult, not a bare array — `truncated` is part of the answer", async () => {
    const result = await gcashService.listAllNonMembers();
    assert.ok(!Array.isArray(result), "a bare array lets a screen render a short list as whole");
    assert.deepEqual(Object.keys(result).sort(), [
      "pagesFetched",
      "rows",
      "total",
      "truncated",
    ]);
  });

  test("a single-page co-op still costs exactly one request", async () => {
    requests = [];
    await gcashService.listNonMembers({ search: "Walk-in 7", per_page: 100 });
    assert.equal(requests.filter((r) => r.path === "/gcash/non-members").length, 1);
  });
});
