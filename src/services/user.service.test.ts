/**
 * `userService.list` / `listAll`, driven over REAL HTTP against a stub that
 * mirrors the sibling repo's `UserController::index()`.
 *
 * The users screen and the three Account Officer pickers each called
 * `userService.list()` with no arguments and treated the answer as everyone.
 * It was the endpoint's default page — 15 users, newest first — and nothing
 * could tell: `api.get` unwrapped the body to its rows and dropped `meta`, and
 * a page and the whole list are the same type. So the assertions here are made
 * on the wire, where the two are different.
 *
 * WHAT THIS PROVES: the client asks for every page, never asks past the
 * server's ceiling, carries its filter on each request, keeps `meta`, and
 * reports a drain that could not finish.
 * WHAT IT DOES NOT PROVE: that the real controller behaves as written — there
 * is no database, no policy layer and no Spatie role scope here. The stub is
 * only as honest as the source it was read from.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

// ── The contract, mirrored from the sibling repo ────────────────────────────

interface Row {
  id: number;
  full_name: string;
  status: "active" | "inactive";
  created_at: string;
  [k: string]: unknown;
}

/**
 * `'per_page' => ['nullable', 'integer', 'min:1']`, then
 * `paginate(min(max((int) ($filters['per_page'] ?? 15), 1), 100))`.
 * Null means the request fails validation.
 */
function perPageFor(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return 15;
  if (!/^\d+$/.test(raw) || Number(raw) < 1) return null;
  return Math.min(Math.max(Number(raw), 1), 100);
}

function paginator(rows: Row[], page: number, perPage: number, all: Row[]) {
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
      // `->additional(['meta' => ['stats' => …]])` — org-wide status counts.
      stats: {
        active: all.filter((r) => r.status === "active").length,
        inactive: all.filter((r) => r.status === "inactive").length,
      },
    },
  };
}

// ── Seed ───────────────────────────────────────────────────────────────────

const USER_COUNT = 237;
/** The co-op's first account, so the LAST row of a newest-first list. */
const FOUNDER_ID = 1;

/** Every 10th account deactivated, so the pickers' `status` filter has work to do. */
function seedUsers(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => {
    const id = i + 1;
    return {
      id,
      full_name: id === FOUNDER_ID ? "Corazon Bautista" : `Staff ${id}`,
      username: `user${id}`,
      email: `user${id}@coop.test`,
      status: id % 10 === 0 ? "inactive" : "active",
      roles: [id === FOUNDER_ID ? "admin" : "loan_officer"],
      branches: [{ id: 1, name: "Main", code: "MN" }],
      created_at: new Date(Date.UTC(2025, 0, 1) + id * 3_600_000).toISOString(),
    };
  });
}

// ── Harness ────────────────────────────────────────────────────────────────

let server: Server;
let requests: Array<{ path: string; query: Record<string, string> }> = [];
let userRows = seedUsers(USER_COUNT);

let userService: typeof import("./user.service").userService;
let toUserList: typeof import("../lib/user-list").toUserList;
let MAX_PER_PAGE: number;
let DEFAULT_MAX_PAGES: number;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname.replace(/^\/api/, "");
    const query = Object.fromEntries(url.searchParams.entries());
    requests.push({ path, query });
    res.setHeader("Content-Type", "application/json");

    if (path === "/users") {
      const perPage = perPageFor(query.per_page);
      if (perPage === null) {
        res.statusCode = 422;
        return res.end(
          JSON.stringify({ message: "The per page field must be at least 1.", errors: { per_page: ["invalid"] } }),
        );
      }
      let rows = userRows;
      if (query.status) rows = rows.filter((r) => r.status === query.status);
      // `->latest()`: newest first.
      rows = [...rows].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      const page = Number.parseInt(query.page ?? "1", 10) || 1;
      return res.end(JSON.stringify(paginator(rows, page, perPage, userRows)));
    }

    return res.end(JSON.stringify({ data: [], links: {}, meta: { total: 0 } }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  // Set BEFORE importing: the axios client resolves its baseURL at module init.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;

  userService = (await import("./user.service")).userService;
  toUserList = (await import("../lib/user-list")).toUserList;
  const paginate = await import("../lib/paginate");
  MAX_PER_PAGE = paginate.MAX_PER_PAGE;
  DEFAULT_MAX_PAGES = paginate.DEFAULT_MAX_PAGES;
});

after(() => {
  server?.close();
});

const userRequests = () => requests.filter((r) => r.path === "/users");

// ── The users screen ───────────────────────────────────────────────────────

describe("users screen — every user, not the default page", () => {
  test("REGRESSION: the call the screen made — no arguments — got the newest 15 of 237", async () => {
    userRows = seedUsers(USER_COUNT);
    // eslint-disable-next-line pagination/no-unparameterised-list -- the defect, on purpose
    const onePage = await userService.list();

    assert.equal(onePage.data.length, 15, "the table, search and Total all worked from these");
    assert.equal(
      onePage.data.some((u) => u.id === FOUNDER_ID),
      false,
      "the co-op's first account is on the last page, so it was simply not there",
    );
    assert.equal(onePage.meta.total, USER_COUNT, "and the response said so all along");
  });

  test("list() keeps `meta` — getRaw, not get", async () => {
    userRows = seedUsers(USER_COUNT);
    const res = await userService.list({ per_page: MAX_PER_PAGE });
    assert.ok(!Array.isArray(res), "api.get would have unwrapped this to a bare array");
    assert.equal(res.meta.last_page, 3);
    assert.equal(res.meta.total, USER_COUNT);
  });

  test("listAll drains 237 users in three requests: 100 + 100 + 37", async () => {
    userRows = seedUsers(USER_COUNT);
    requests = [];

    const { rows, total, truncated, pagesFetched } = await userService.listAll();

    assert.equal(rows.length, USER_COUNT);
    assert.equal(total, USER_COUNT, "`meta.total` survived, so a shortfall could quote it");
    assert.equal(truncated, false);
    assert.equal(pagesFetched, 3);
    assert.deepEqual(
      userRequests().map((r) => r.query.page),
      ["1", "2", "3"],
    );
    assert.ok(
      userRequests().every((r) => Number(r.query.per_page) === MAX_PER_PAGE),
      "asks for the ceiling each time, never past it",
    );
    assert.equal(new Set(rows.map((u) => u.id)).size, USER_COUNT, "no page overlap or gap");
    assert.ok(rows.some((u) => u.id === FOUNDER_ID), "page 3 arrived");
  });

  test("it returns a DrainResult, not a bare array — `truncated` is part of the answer", async () => {
    userRows = seedUsers(USER_COUNT);
    const result = await userService.listAll();
    assert.ok(!Array.isArray(result), "a bare array lets a screen render a short list as whole");
    assert.deepEqual(Object.keys(result).sort(), [
      "pagesFetched",
      "rows",
      "total",
      "truncated",
    ]);
  });

  test("past the runaway guard the drain says it is short, and the screen's shortfall quotes the total", async () => {
    const count = 2_037;
    userRows = seedUsers(count);
    requests = [];

    const drain = await userService.listAll();

    assert.equal(drain.truncated, true);
    assert.equal(drain.pagesFetched, DEFAULT_MAX_PAGES);
    assert.equal(userRequests().length, DEFAULT_MAX_PAGES);
    assert.equal(drain.rows.length, DEFAULT_MAX_PAGES * MAX_PER_PAGE);
    assert.equal(drain.total, count);
    assert.deepEqual(toUserList(drain).shortfall, {
      shown: DEFAULT_MAX_PAGES * MAX_PER_PAGE,
      total: count,
    });
  });
});

// ── The Account Officer pickers ────────────────────────────────────────────

describe("Account Officer pickers — every ACTIVE user", () => {
  test("`status=active` rides on every page, not just the first", async () => {
    userRows = seedUsers(USER_COUNT);
    requests = [];
    const active = userRows.filter((r) => r.status === "active").length;

    const { rows, total, truncated } = await userService.listAll({ status: "active" });

    assert.ok(userRequests().length > 1, `${active} active users still cost more than one page`);
    for (const r of userRequests()) assert.equal(r.query.status, "active");
    assert.equal(truncated, false);
    assert.equal(rows.length, active);
    assert.equal(total, active, "the shortfall, if any, counts what the picker shows");
    assert.equal(
      rows.some((u) => u.status !== "active"),
      false,
      "a deactivated account must not be assignable",
    );
    assert.ok(rows.some((u) => u.id === FOUNDER_ID), "the longest-serving account is assignable");
  });

  test("a caller cannot smuggle its own page size past the drain", async () => {
    userRows = seedUsers(USER_COUNT);
    requests = [];
    // Not in the type — `page`/`per_page` belong to the drain — but a cast
    // must not be able to put the server's default page back in charge.
    const smuggled = { status: "active", per_page: 15 } as Parameters<
      typeof userService.listAll
    >[0];
    await userService.listAll(smuggled);
    assert.ok(userRequests().length > 0);
    assert.ok(userRequests().every((r) => r.query.per_page === String(MAX_PER_PAGE)));
  });
});
