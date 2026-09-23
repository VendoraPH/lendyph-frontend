import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MAX_PAGES,
  MAX_PER_PAGE,
  fetchAllPages,
  type PageFetcher,
} from "./paginate";
import { countUsersWithRole, filterUsers, toUserList } from "./user-list";
import type { User, UserBranch } from "@/types";

type RequestLog = { page: number; per_page: number }[];

/** What `UserController::index()` serves when the client sends no `per_page`. */
const SERVER_DEFAULT_PER_PAGE = 15;

const MAIN: UserBranch = { id: 1, name: "Main", code: "MN" };

function user(id: number, over: Partial<User> = {}): User {
  return {
    id,
    first_name: `First${id}`,
    last_name: `Last${id}`,
    full_name: `First${id} Last${id}`,
    username: `user${id}`,
    email: `user${id}@coop.test`,
    status: "active",
    branches: [MAIN],
    roles: ["loan_officer"],
    permissions: [],
    must_change_password: false,
    created_at: new Date(Date.UTC(2025, 0, 1) + id * 86_400_000).toISOString(),
    updated_at: new Date(Date.UTC(2025, 0, 1) + id * 86_400_000).toISOString(),
    ...over,
  };
}

/**
 * 237 users — three pages of 100 + 100 + 37 — in the order the endpoint serves
 * them: `->latest()`, newest first. So the accounts that fall off a short list
 * are the OLDEST ones:
 *   - id 1, the admin who set the co-op up;
 *   - ids 2–13, the twelve collectors hired early;
 *   - ids 14–237, cashiers (even ids) and loan officers (odd ids).
 */
const USER_COUNT = 237;
const FOUNDER = user(1, {
  first_name: "Corazon",
  last_name: "Bautista",
  full_name: "Corazon Bautista",
  username: "cbautista",
  email: "corazon@coop.test",
  roles: ["admin"],
});

function seedUsers(count = USER_COUNT): User[] {
  const rows: User[] = [FOUNDER];
  for (let id = 2; id <= count; id++) {
    const role = id <= 13 ? "collector" : id % 2 === 0 ? "cashier" : "loan_officer";
    rows.push(user(id, { roles: [role] }));
  }
  return rows.reverse();
}

/**
 * `UserController::index()` as far as the drain can see it: `per_page` is
 * clamped to `min(max(per_page, 1), 100)` without a word, and pages past the
 * end come back empty. `served` records how many rows each response carried.
 */
function stubUsersApi(rows: User[], log: RequestLog, served: number[] = []): PageFetcher {
  return async ({ page, per_page }) => {
    log.push({ page, per_page });
    const perPage = Math.min(Math.max(per_page, 1), 100);
    const start = (page - 1) * perPage;
    const data = rows.slice(start, start + perPage);
    served.push(data.length);
    return {
      data,
      links: {},
      meta: {
        current_page: page,
        last_page: Math.max(1, Math.ceil(rows.length / perPage)),
        per_page: perPage,
        total: rows.length,
      },
    };
  };
}

test("three pages of 100 + 100 + 37: every user comes back, the oldest included", async () => {
  const log: RequestLog = [];
  const served: number[] = [];

  const drain = await fetchAllPages<User>(stubUsersApi(seedUsers(), log, served));
  const { users, shortfall } = toUserList(drain);

  assert.deepEqual(served, [100, 100, 37]);
  assert.deepEqual(
    log.map((r) => r.page),
    [1, 2, 3],
  );
  assert.ok(
    log.every((r) => r.per_page === MAX_PER_PAGE),
    "each request asks for the ceiling, not a guess above it",
  );
  assert.equal(users.length, USER_COUNT);
  assert.equal(shortfall, null, "a complete list is not a shortfall");
  assert.equal(new Set(users.map((u) => u.id)).size, USER_COUNT, "no page overlap or gap");
  assert.equal(users.at(-1)?.id, FOUNDER.id, "the oldest account sits on page 3 — and arrives");
});

/**
 * The bug, stated as a test. The screen took the endpoint's default page and
 * computed everything from it in the browser, so every figure on it was
 * computed over the newest 15 accounts.
 */
test("REGRESSION: over one default page the search, Total and role counts were all short", async () => {
  const api = stubUsersApi(seedUsers(), []);

  // What `userService.list()` with no arguments received.
  const onePage = (await api({ page: 1, per_page: SERVER_DEFAULT_PER_PAGE })) as { data: User[] };
  const oldUsers = onePage.data;
  assert.equal(oldUsers.length, 15, "the Total card said 15");
  assert.deepEqual(filterUsers(oldUsers, "bautista"), [], "the founding admin could not be found");
  assert.equal(countUsersWithRole(oldUsers, "admin"), 0, "the Admin card said 0");
  assert.equal(countUsersWithRole(oldUsers, "collector"), 0, "twelve collectors read as none");

  // What the screen computes now, from the drain.
  const { users } = toUserList(await fetchAllPages<User>(api));
  assert.equal(users.length, USER_COUNT);
  assert.deepEqual(
    filterUsers(users, "bautista").map((u) => u.id),
    [FOUNDER.id],
  );
  assert.equal(countUsersWithRole(users, "admin"), 1);
  assert.equal(countUsersWithRole(users, "collector"), 12);
  assert.equal(countUsersWithRole(users, "cashier"), 112);
  assert.equal(countUsersWithRole(users, "loan_officer"), 112);
});

test("a truncated drain is reported as a shortfall, with the server's total", async () => {
  // More users than the runaway guard will page through: 21 pages, and the
  // drain stops after DEFAULT_MAX_PAGES of them.
  const log: RequestLog = [];
  const count = DEFAULT_MAX_PAGES * MAX_PER_PAGE + 37;

  const drain = await fetchAllPages<User>(stubUsersApi(seedUsers(count), log));
  const { users, shortfall } = toUserList(drain);

  assert.equal(log.length, DEFAULT_MAX_PAGES);
  assert.equal(users.length, DEFAULT_MAX_PAGES * MAX_PER_PAGE);
  assert.deepEqual(
    shortfall,
    { shown: DEFAULT_MAX_PAGES * MAX_PER_PAGE, total: count },
    "the screen must be told it holds 2,000 of 2,037 users, not handed 2,000 as the lot",
  );
  assert.equal(
    users.some((u) => u.id === FOUNDER.id),
    false,
    "and the missing ones are the oldest — which is why it has to be said out loud",
  );
});

test("a truncated drain with no usable total still reports a shortfall, without inventing one", async () => {
  // `last_page` always claims another page, and there is no `total` to quote.
  const api: PageFetcher = async ({ page }) => ({
    data: Array.from({ length: 100 }, (_, i) => user(page * 1000 + i)),
    meta: { current_page: page, last_page: 9999, per_page: 100 },
  });

  const { shortfall } = toUserList(await fetchAllPages<User>(api, { maxPages: 3 }));

  assert.deepEqual(shortfall, { shown: 300, total: null });
});

test("an empty list is complete, not a shortfall", async () => {
  const { users, shortfall } = toUserList(await fetchAllPages<User>(stubUsersApi([], [])));

  assert.deepEqual(users, []);
  assert.equal(shortfall, null);
});

// ── The search box, moved out of the page verbatim ─────────────────────────

test("an empty search matches everyone, in the order they loaded", () => {
  const users = seedUsers(20);
  assert.deepEqual(filterUsers(users, ""), users);
});

test("search is a case-insensitive match on name, username and email", () => {
  const users = seedUsers(20);
  for (const query of ["CORAZON bautista", "CBautista", "corazon@COOP"]) {
    assert.deepEqual(
      filterUsers(users, query).map((u) => u.id),
      [FOUNDER.id],
      `"${query}"`,
    );
  }
});

test("search matches any assigned branch, in either payload shape", () => {
  const north: UserBranch = { id: 9, name: "North", code: "NO" };
  const multi = user(501, { branches: [MAIN, north] });
  // The pre-multi-branch shape: a single `branch` and no `branches` at all.
  const legacy = user(502, { branches: undefined, branch: north });
  const elsewhere = user(503);

  assert.deepEqual(
    filterUsers([multi, legacy, elsewhere], "north").map((u) => u.id),
    [501, 502],
  );
});

test("search matches the role", () => {
  assert.deepEqual(
    filterUsers(seedUsers(), "collector").map((u) => u.id),
    [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
  );
});
