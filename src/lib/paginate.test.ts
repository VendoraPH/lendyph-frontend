import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MAX_PAGES,
  MAX_PER_PAGE,
  fetchAllPages,
  type PageFetcher,
} from "./paginate";

type RequestLog = { page: number; per_page: number }[];

interface Row {
  id: number;
}

const row = (id: number): Row => ({ id });

/**
 * A stand-in for any of these controllers' `index()`, reproducing the two
 * behaviours the drain depends on: `per_page` is silently clamped rather than
 * rejected, and pages past the end come back empty.
 */
function stubApi(rows: Row[], log: RequestLog, maxPerPage = 100): PageFetcher {
  return async ({ page, per_page }) => {
    log.push({ page, per_page });
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
    };
  };
}

test("collects every row across pages, not just the first", async () => {
  const rows = Array.from({ length: 237 }, (_, i) => row(i + 1));
  const log: RequestLog = [];

  const result = await fetchAllPages<Row>(stubApi(rows, log));

  assert.equal(result.rows.length, 237);
  assert.equal(result.total, 237);
  assert.equal(result.truncated, false);
  assert.equal(result.pagesFetched, 3);
  assert.deepEqual(
    result.rows.map((r) => r.id),
    rows.map((r) => r.id),
  );
});

/**
 * The bug, stated as a test.
 *
 * `per_page: 9999` was not rejected — it came back as 100 rows with a
 * well-formed `meta`, and the screen rendered them as the whole membership.
 * A drain has to notice the clamp; a single request cannot.
 */
test("a single clamped request loses rows; the drain does not", async () => {
  const rows = Array.from({ length: 260 }, (_, i) => row(i + 1));
  const log: RequestLog = [];
  const api = stubApi(rows, log);

  // What the old call site did: one request, per_page: 9999.
  const single = (await api({ page: 1, per_page: 9999 })) as { data: Row[] };
  assert.equal(single.data.length, 100);
  assert.equal(
    single.data.some((r) => r.id === 260),
    false,
    "row 260 is silently absent from the clamped page",
  );

  const drained = await fetchAllPages<Row>(api);
  assert.equal(drained.rows.length, 260);
  assert.equal(
    drained.rows.some((r) => r.id === 260),
    true,
  );
});

test("asks for the server's documented maximum page size", async () => {
  const log: RequestLog = [];
  await fetchAllPages<Row>(stubApi([row(1)], log));

  assert.equal(MAX_PER_PAGE, 100);
  assert.equal(log[0].per_page, 100);
});

test("stops after one request when the whole set fits on one page", async () => {
  const rows = Array.from({ length: 40 }, (_, i) => row(i + 1));
  const log: RequestLog = [];

  const result = await fetchAllPages<Row>(stubApi(rows, log));

  assert.equal(result.rows.length, 40);
  assert.equal(result.pagesFetched, 1);
  assert.equal(log.length, 1);
});

test("an empty list is complete, not truncated, and reports a total of 0", async () => {
  const log: RequestLog = [];

  const result = await fetchAllPages<Row>(stubApi([], log));

  assert.deepEqual(result.rows, []);
  assert.equal(result.total, 0, "0 is a real total, not a missing one");
  assert.equal(result.truncated, false);
  assert.equal(log.length, 1);
});

test("follows meta.last_page rather than the caller's own page size", async () => {
  // The server clamps to 25 here, so a 'full' page is smaller than requested.
  // Comparing against the requested size would stop the loop after page 1.
  const rows = Array.from({ length: 60 }, (_, i) => row(i + 1));
  const log: RequestLog = [];

  const result = await fetchAllPages<Row>(stubApi(rows, log, 25));

  assert.equal(result.rows.length, 60);
  assert.deepEqual(
    log.map((r) => r.page),
    [1, 2, 3],
  );
});

test("without meta.last_page, a short page ends the loop", async () => {
  const rows = Array.from({ length: 12 }, (_, i) => row(i + 1));
  const log: RequestLog = [];
  const api: PageFetcher = async ({ page, per_page }) => {
    log.push({ page, per_page });
    const start = (page - 1) * 5;
    return { data: rows.slice(start, start + 5), meta: { per_page: 5 } };
  };

  const result = await fetchAllPages<Row>(api);

  assert.equal(result.rows.length, 12);
  assert.equal(result.total, null, "no usable total was sent");
  assert.equal(result.truncated, false);
  assert.deepEqual(
    log.map((r) => r.page),
    [1, 2, 3],
  );
});

test("a paginator that never ends is bounded, and says it was bounded", async () => {
  const log: RequestLog = [];
  // last_page lies: it always claims there is another page.
  const api: PageFetcher = async ({ page, per_page }) => {
    log.push({ page, per_page });
    return {
      data: [row(page)],
      meta: { current_page: page, last_page: 9999, per_page: 1, total: 9999 },
    };
  };

  const result = await fetchAllPages<Row>(api, { maxPages: 4 });

  assert.equal(result.truncated, true, "truncation must be visible");
  assert.equal(result.pagesFetched, 4);
  assert.equal(result.rows.length, 4);
  assert.equal(result.total, 9999, "the caller can see how much it is missing");
});

test("the default runaway guard is a guard, not a row limit", async () => {
  // 20 pages of 100 is 2,000 rows — reached only by a pathological paginator.
  assert.equal(DEFAULT_MAX_PAGES, 20);

  const rows = Array.from({ length: 1500 }, (_, i) => row(i + 1));
  const result = await fetchAllPages<Row>(stubApi(rows, []));

  assert.equal(result.rows.length, 1500);
  assert.equal(result.truncated, false);
});

test("tolerates a bare array body with no meta", async () => {
  const api: PageFetcher = async () => [row(1), row(2)];

  const result = await fetchAllPages<Row>(api);

  assert.equal(result.rows.length, 2);
  assert.equal(result.total, null);
  assert.equal(result.truncated, false);
});

test("tolerates a malformed body without throwing", async () => {
  const api: PageFetcher = async () => ({ data: null, meta: "nope" });

  const result = await fetchAllPages<Row>(api);

  assert.deepEqual(result.rows, []);
  assert.equal(result.total, null);
  assert.equal(result.truncated, false);
});
