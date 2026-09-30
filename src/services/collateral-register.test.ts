/**
 * `collateralService.registerPage`, over REAL HTTP against a stub of
 * `GET /collaterals/register` as its contract describes it.
 *
 * WHAT THIS PROVES: the register asks one question per view — the right path,
 * the right query, nothing else — and keeps the whole body. The body matters
 * more than usual here: `meta` carries the KPI totals and `names_hidden` as well
 * as the paging, and `api.get` would hand back the groups alone with no error.
 * WHAT IT DOES NOT PROVE: that the controller groups, values or sorts as
 * written. The stub pages and sorts only so the answers look like the real ones.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { CollateralRegisterGroup } from "../types";
import {
  ALL_TYPES,
  DEFAULT_REGISTER_SORT,
  registerQuery,
  type RegisterView,
} from "../app/(app)/collaterals/_lib/register";

// ── The contract, mirrored ─────────────────────────────────────────────────

const MEMBER_COUNT = 23;

function seedGroups(): CollateralRegisterGroup[] {
  return Array.from({ length: MEMBER_COUNT }, (_, i) => ({
    borrower_id: i + 1,
    borrower_name: `Member ${String.fromCharCode(65 + (i % 26))}${i}`,
    collaterals_count: (i % 3) + 1,
    tagged_count: i % 2,
    total_value: 1000 * (i + 1),
    unknown_count: 0,
    collaterals: [],
  }));
}

/** Clamped like every list: default 15, at most 100, at least 1. */
const clamp = (raw: string | undefined) =>
  Math.min(Math.max(Number.parseInt(raw ?? "", 10) || 15, 1), 100);

function answer(query: Record<string, string>, namesHidden: boolean) {
  let groups = seedGroups();
  if (namesHidden) {
    groups = groups.map((g) => ({ ...g, borrower_name: `Member #${g.borrower_id}` }));
  }
  if (query.search) {
    const q = query.search.toLowerCase();
    groups = groups.filter((g) => g.borrower_name.toLowerCase().includes(q));
  }
  const key = {
    member: (g: CollateralRegisterGroup) => g.borrower_name,
    collaterals: (g: CollateralRegisterGroup) => g.collaterals_count,
    total_value: (g: CollateralRegisterGroup) => g.total_value,
    tagged: (g: CollateralRegisterGroup) => g.tagged_count,
  }[query.sort ?? "member"] ?? ((g: CollateralRegisterGroup) => g.borrower_name);
  const sign = query.direction === "desc" ? -1 : 1;
  groups.sort((a, b) => {
    const [x, y] = [key(a), key(b)];
    const primary = x < y ? -1 : x > y ? 1 : 0;
    return sign * primary || a.borrower_name.localeCompare(b.borrower_name) || a.borrower_id - b.borrower_id;
  });

  const perPage = clamp(query.per_page);
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  return {
    data: groups.slice((page - 1) * perPage, page * perPage),
    links: { first: "…", last: "…", prev: null, next: null },
    meta: {
      current_page: page,
      from: (page - 1) * perPage + 1,
      last_page: Math.max(1, Math.ceil(groups.length / perPage)),
      path: "…/collaterals/register",
      per_page: perPage,
      to: Math.min(page * perPage, groups.length),
      total: groups.length,
      names_hidden: namesHidden,
      totals: {
        total_collaterals: 46,
        tagged_to_active_loans: 11,
        total_value: groups.reduce((s, g) => s + g.total_value, 0),
        unknown_count: 0,
        members: groups.length,
      },
    },
  };
}

// ── Harness ────────────────────────────────────────────────────────────────

let server: Server;
let requests: Array<{ path: string; query: Record<string, string> }> = [];
let namesHidden = false;
/** An API from before this endpoint existed. */
let registerMissing = false;
let collateralService: typeof import("./collateral.service").collateralService;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname.replace(/^\/api/, "");
    const query = Object.fromEntries(url.searchParams.entries());
    requests.push({ path, query });
    res.setHeader("Content-Type", "application/json");
    if (path === "/collaterals/register" && !registerMissing) {
      return res.end(JSON.stringify(answer(query, namesHidden)));
    }
    res.statusCode = 404;
    return res.end(JSON.stringify({ message: "Not found" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  // Set BEFORE importing: axios-client resolves its baseURL at module init.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  collateralService = (await import("./collateral.service")).collateralService;
});

after(() => {
  server?.close();
});

const view = (over: Partial<RegisterView> = {}): RegisterView => ({
  search: "",
  typeFilter: ALL_TYPES,
  sort: DEFAULT_REGISTER_SORT,
  page: 1,
  perPage: 10,
  ...over,
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("collateral register (collaterals/page.tsx)", () => {
  test("one view is ONE request, to the register — no drain, no member list, no ledgers", async () => {
    requests = [];
    await collateralService.registerPage(registerQuery(view()));

    assert.deepEqual(
      requests.map((r) => r.path),
      ["/collaterals/register"],
    );
  });

  test("the view goes out as the contract's query, and nothing it did not ask for", async () => {
    requests = [];
    await collateralService.registerPage(
      registerQuery(
        view({
          search: " celia ",
          typeFilter: "3",
          sort: { key: "total_value", dir: "desc" },
          page: 2,
          perPage: 20,
        }),
      ),
    );

    assert.deepEqual(requests[0]?.query, {
      search: "celia",
      collateral_type_id: "3",
      sort: "total_value",
      direction: "desc",
      page: "2",
      per_page: "20",
    });
  });

  test("an unfiltered view sends no empty search or type for the server to validate", async () => {
    requests = [];
    await collateralService.registerPage(registerQuery(view()));

    assert.deepEqual(Object.keys(requests[0]?.query ?? {}).sort(), [
      "direction",
      "page",
      "per_page",
      "sort",
    ]);
  });

  test("the whole body comes back: groups, paging, totals and names_hidden", async () => {
    const res = await collateralService.registerPage(registerQuery(view({ perPage: 10 })));

    assert.equal(res.data.length, 10);
    assert.equal(typeof res.data[0]?.borrower_id, "number");
    // Paging is over MEMBERS: 23 groups at 10 a page is 3 pages.
    assert.equal(res.meta.total, MEMBER_COUNT);
    assert.equal(res.meta.last_page, 3);
    assert.equal(res.meta.names_hidden, false);
    assert.equal(res.meta.totals.total_collaterals, 46);
    assert.equal(res.meta.totals.tagged_to_active_loans, 11);
    assert.equal(res.meta.totals.members, MEMBER_COUNT);
  });

  test("the last page holds the remainder, and a page past the end is empty rather than an error", async () => {
    const last = await collateralService.registerPage(registerQuery(view({ page: 3 })));
    assert.equal(last.data.length, MEMBER_COUNT - 20);

    const past = await collateralService.registerPage(registerQuery(view({ page: 4 })));
    assert.equal(past.data.length, 0);
    assert.equal(past.meta.last_page, 3);
  });

  test("names_hidden reaches the page when the caller cannot see member records", async () => {
    namesHidden = true;
    try {
      const res = await collateralService.registerPage(registerQuery(view()));
      assert.equal(res.meta.names_hidden, true);
      assert.ok(res.data.every((g) => g.borrower_name === `Member #${g.borrower_id}`));
    } finally {
      namesHidden = false;
    }
  });

  test("an API without the endpoint rejects with its 404, which the page shows as not connected", async () => {
    // An API from before this endpoint routes `/collaterals/register` to
    // `/collaterals/{collateral}` and 404s on the binding. `useApiResource`
    // reads `response.status` to tell that apart from a failure, so the status
    // has to reach it untouched.
    registerMissing = true;
    try {
      await assert.rejects(
        collateralService.registerPage(registerQuery(view())),
        (err: unknown) =>
          (err as { response?: { status?: number } }).response?.status === 404,
      );
    } finally {
      registerMissing = false;
    }
  });
});
