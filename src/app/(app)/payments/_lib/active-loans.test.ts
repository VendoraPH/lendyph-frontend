import { test } from "node:test";
import assert from "node:assert/strict";
import type { Loan, PaginatedResponse } from "@/types";
import {
  ACTIVE_STATUS,
  LOANS_PER_PAGE,
  fetchAllActiveLoans,
  type LoanPageFetcher,
} from "./active-loans";

type RequestLog = { status: string; page: number; per_page: number }[];

const loan = (id: number): Loan => ({ id }) as Loan;

/**
 * A stand-in for `LoanController::index()`, reproducing the two behaviours this
 * screen depends on: `per_page` is silently clamped to 100 rather than
 * rejected, and pages past the end come back empty.
 */
function stubApi(rows: Loan[], log: RequestLog, maxPerPage = 100): LoanPageFetcher {
  return async ({ status, page, per_page }) => {
    log.push({ status, page, per_page });
    const perPage = Math.min(Math.max(per_page, 1), maxPerPage);
    const start = (page - 1) * perPage;
    return {
      data: rows.slice(start, start + perPage),
      meta: {
        current_page: page,
        last_page: Math.max(1, Math.ceil(rows.length / perPage)),
        per_page: perPage,
        total: rows.length,
      },
    } satisfies PaginatedResponse<Loan>;
  };
}

test("collects every active loan across pages, not just the first", async () => {
  const rows = Array.from({ length: 237 }, (_, i) => loan(i + 1));
  const log: RequestLog = [];

  const result = await fetchAllActiveLoans(stubApi(rows, log));

  assert.equal(result.loans.length, 237);
  assert.equal(result.total, 237);
  assert.equal(result.truncated, false);
  assert.deepEqual(
    result.loans.map((l) => l.id),
    rows.map((l) => l.id),
  );
});

// The bug: `per_page: 500` was clamped to 100 server-side and the screen kept
// the truncated page as if it were everything.
test("asks for the server's documented maximum page size, so nothing is clamped away", async () => {
  const log: RequestLog = [];
  await fetchAllActiveLoans(stubApi([loan(1)], log));

  assert.equal(LOANS_PER_PAGE, 100);
  assert.equal(log[0].per_page, 100);
});

test("filters server-side with the virtual active status on every page", async () => {
  const rows = Array.from({ length: 150 }, (_, i) => loan(i + 1));
  const log: RequestLog = [];

  await fetchAllActiveLoans(stubApi(rows, log));

  assert.equal(ACTIVE_STATUS, "active");
  assert.deepEqual(
    log.map((r) => r.status),
    ["active", "active"],
  );
  assert.deepEqual(
    log.map((r) => r.page),
    [1, 2],
  );
});

test("stops after one request when the whole set fits on one page", async () => {
  const rows = Array.from({ length: 40 }, (_, i) => loan(i + 1));
  const log: RequestLog = [];

  const result = await fetchAllActiveLoans(stubApi(rows, log));

  assert.equal(log.length, 1);
  assert.equal(result.loans.length, 40);
});

// An exact multiple of the page size is the boundary case: page 2 is full, page
// 3 is empty, and `last_page` is what stops this rather than a short page.
test("stops on last_page when the final page is exactly full", async () => {
  const rows = Array.from({ length: 200 }, (_, i) => loan(i + 1));
  const log: RequestLog = [];

  const result = await fetchAllActiveLoans(stubApi(rows, log));

  assert.equal(result.loans.length, 200);
  assert.equal(log.length, 2);
  assert.equal(result.truncated, false);
});

// Regression: "is this page full?" was measured against the size we ASKED for,
// so a server clamping harder than expected returned a page that looked short
// and the loop stopped after one of twenty-seven pages — silently, which is the
// exact shape of the bug this module replaces. The end of the list is the
// server's to declare, not ours to infer from our own number.
test("keeps paging when the server clamps per_page below the request", async () => {
  const rows = Array.from({ length: 132 }, (_, i) => loan(i + 1));
  const log: RequestLog = [];

  const result = await fetchAllActiveLoans(stubApi(rows, log, 5), {
    maxPages: 40,
  });

  assert.equal(log.length, 27); // ceil(132 / 5)
  assert.equal(log[0].per_page, 100); // still asked for the documented maximum
  assert.equal(result.loans.length, 132);
  assert.equal(result.truncated, false);
});

test("reports an empty portfolio as a real zero, not as unknown", async () => {
  const result = await fetchAllActiveLoans(stubApi([], []));

  assert.deepEqual(result.loans, []);
  assert.equal(result.total, 0);
  assert.equal(result.truncated, false);
});

// The guard has to be loud. A silent cap is the bug it replaces.
test("flags truncation instead of silently returning a partial list", async () => {
  const rows = Array.from({ length: 1000 }, (_, i) => loan(i + 1));
  const log: RequestLog = [];

  const result = await fetchAllActiveLoans(stubApi(rows, log), {
    perPage: 10,
    maxPages: 3,
  });

  assert.equal(log.length, 3);
  assert.equal(result.loans.length, 30);
  assert.equal(result.truncated, true);
  // The caller can name what is missing, because the total is the server's.
  assert.equal(result.total, 1000);
});

test("a page count that fits exactly inside the guard is not flagged", async () => {
  const rows = Array.from({ length: 30 }, (_, i) => loan(i + 1));

  const result = await fetchAllActiveLoans(stubApi(rows, []), {
    perPage: 10,
    maxPages: 3,
  });

  assert.equal(result.loans.length, 30);
  assert.equal(result.truncated, false);
});

// Talking to an API build that answers with the bare `{success, data}` envelope
// (or that `api.get` has already unwrapped) must not spin: one full-looking
// page with no `meta` has to terminate on the short page, not on the guard.
test("survives a response with no meta by stopping at the first short page", async () => {
  const log: RequestLog = [];
  const fetchPage = (async ({ page, per_page }) => {
    log.push({ status: ACTIVE_STATUS, page, per_page });
    return {
      data: page === 1 ? Array.from({ length: 100 }, (_, i) => loan(i + 1)) : [],
    } as unknown as PaginatedResponse<Loan>;
  }) satisfies LoanPageFetcher;

  const result = await fetchAllActiveLoans(fetchPage);

  assert.equal(log.length, 2);
  assert.equal(result.loans.length, 100);
  assert.equal(result.total, null);
  assert.equal(result.truncated, false);
});

test("treats a bare array response as a single complete page", async () => {
  const fetchPage = (async () =>
    [loan(1), loan(2)] as unknown as PaginatedResponse<Loan>) satisfies LoanPageFetcher;

  const result = await fetchAllActiveLoans(fetchPage);

  assert.equal(result.loans.length, 2);
  assert.equal(result.total, null);
  assert.equal(result.truncated, false);
});

// A nonsense `last_page` must not be able to outrun the guard.
test("a runaway last_page is bounded by the guard and reported", async () => {
  const log: RequestLog = [];
  const fetchPage = (async ({ page, per_page }) => {
    log.push({ status: ACTIVE_STATUS, page, per_page });
    return {
      data: Array.from({ length: 10 }, (_, i) => loan(page * 100 + i)),
      meta: {
        current_page: page,
        last_page: 999_999,
        per_page: 10,
        total: 9_999_990,
      },
    } satisfies PaginatedResponse<Loan>;
  }) satisfies LoanPageFetcher;

  const result = await fetchAllActiveLoans(fetchPage, {
    perPage: 10,
    maxPages: 5,
  });

  assert.equal(log.length, 5);
  assert.equal(result.truncated, true);
});

test("ignores a non-numeric or zero last_page rather than stopping on it", async () => {
  const log: RequestLog = [];
  const fetchPage = (async ({ page, per_page }) => {
    log.push({ status: ACTIVE_STATUS, page, per_page });
    return {
      data: page <= 2 ? Array.from({ length: 10 }, (_, i) => loan(page * 10 + i)) : [],
      meta: { current_page: page, last_page: 0, per_page: 10, total: 20 },
    } satisfies PaginatedResponse<Loan>;
  }) satisfies LoanPageFetcher;

  const result = await fetchAllActiveLoans(fetchPage, { perPage: 10 });

  assert.equal(result.loans.length, 20);
  assert.equal(log.length, 3);
  assert.equal(result.truncated, false);
});

test("propagates a failed page rather than returning a partial list as complete", async () => {
  const fetchPage = (async ({ page }) => {
    if (page === 2) throw new Error("boom");
    return {
      data: Array.from({ length: 10 }, (_, i) => loan(i + 1)),
      meta: { current_page: 1, last_page: 4, per_page: 10, total: 40 },
    } satisfies PaginatedResponse<Loan>;
  }) satisfies LoanPageFetcher;

  await assert.rejects(
    () => fetchAllActiveLoans(fetchPage, { perPage: 10 }),
    /boom/,
  );
});
