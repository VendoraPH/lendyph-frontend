import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MAX_PAGES,
  IncompleteListError,
  MAX_PER_PAGE,
  completeRows,
  fetchAllPages,
  type DrainResult,
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

// ── Endpoints that do not paginate at all ──────────────────────────────────

/**
 * `Resource::collection($query->get())` — every row in one body, no `meta`, no
 * `links`, and `page` ignored: page 2 is page 1 again. Roles, branches, fees,
 * loan products, collateral types, collaterals and the GCash pending report
 * all answer like this today.
 */
function stubWholeCollection(rows: Row[], log: RequestLog): PageFetcher {
  return async ({ page, per_page }) => {
    log.push({ page, per_page });
    return { data: rows };
  };
}

/**
 * The bug this guards against: 150 rows is a "full" page by the short-page
 * test, so the drain used to ask for page 2, get the same 150 back, and so on
 * until the runaway guard — 3,000 rows of 150 repeated, marked truncated.
 */
test("an unpaginated body is the whole collection, at any size", async () => {
  const rows = Array.from({ length: 150 }, (_, i) => row(i + 1));
  const log: RequestLog = [];

  const result = await fetchAllPages<Row>(stubWholeCollection(rows, log));

  assert.equal(log.length, 1, "there is no page 2 to ask for");
  assert.equal(result.pagesFetched, 1);
  assert.equal(result.rows.length, 150);
  assert.equal(new Set(result.rows.map((r) => r.id)).size, 150, "no duplicates");
  assert.equal(result.total, 150, "the body is every row, so it is its own total");
  assert.equal(result.truncated, false);
});

test("the { success, data } envelope without a paginator is whole too", async () => {
  const rows = Array.from({ length: 120 }, (_, i) => row(i + 1));
  const log: RequestLog = [];
  const api: PageFetcher = async ({ page, per_page }) => {
    log.push({ page, per_page });
    return { success: true, data: rows, message: "OK" };
  };

  const result = await fetchAllPages<Row>(api);

  assert.equal(log.length, 1);
  assert.equal(result.rows.length, 120);
  assert.equal(result.total, 120);
});

test("an empty unpaginated collection is complete with a total of 0", async () => {
  const log: RequestLog = [];

  const result = await fetchAllPages<Row>(stubWholeCollection([], log));

  assert.deepEqual(result.rows, []);
  assert.equal(result.total, 0);
  assert.equal(result.truncated, false);
  assert.equal(log.length, 1);
});

test("any one paginator key is enough to keep reading pages", async () => {
  // A full first page carrying exactly one marker, then an empty page. Each of
  // these is a paginator, so the drain must ask for page 2 rather than take
  // page 1 as the whole list.
  const markers: Record<string, unknown> = {
    meta: {},
    links: {},
    current_page: 1,
    last_page: 2,
    per_page: 100,
    total: 100,
    next_page_url: "http://api.test/things?page=2",
  };
  for (const [key, value] of Object.entries(markers)) {
    const log: RequestLog = [];
    const api: PageFetcher = async ({ page, per_page }) => {
      log.push({ page, per_page });
      const data =
        page === 1 ? Array.from({ length: 100 }, (_, i) => row(i + 1)) : [];
      return { data, [key]: value };
    };

    const result = await fetchAllPages<Row>(api);

    assert.equal(log.length, 2, `\`${key}\` marks a paginator`);
    assert.equal(result.rows.length, 100);
  }
});

/**
 * `response()->json($paginator)` with no resource wrapper: the paginator's own
 * fields sit beside `data` instead of under `meta`.
 */
function stubBarePaginator(rows: Row[], log: RequestLog, maxPerPage = 100): PageFetcher {
  return async ({ page, per_page }) => {
    log.push({ page, per_page });
    const perPage = Math.min(Math.max(per_page, 1), maxPerPage);
    const lastPage = Math.max(1, Math.ceil(rows.length / perPage));
    const start = (page - 1) * perPage;
    return {
      current_page: page,
      data: rows.slice(start, start + perPage),
      first_page_url: "http://api.test/things?page=1",
      from: start + 1,
      last_page: lastPage,
      last_page_url: `http://api.test/things?page=${lastPage}`,
      next_page_url: page < lastPage ? `http://api.test/things?page=${page + 1}` : null,
      path: "http://api.test/things",
      per_page: perPage,
      prev_page_url: page > 1 ? `http://api.test/things?page=${page - 1}` : null,
      to: Math.min(start + perPage, rows.length),
      total: rows.length,
    };
  };
}

test("a bare top-level paginator still drains every page", async () => {
  const rows = Array.from({ length: 237 }, (_, i) => row(i + 1));
  const log: RequestLog = [];

  const result = await fetchAllPages<Row>(stubBarePaginator(rows, log));

  assert.equal(result.rows.length, 237);
  assert.equal(new Set(result.rows.map((r) => r.id)).size, 237);
  assert.equal(result.total, 237, "read from the top level, not only from `meta`");
  assert.equal(result.truncated, false);
  assert.deepEqual(
    log.map((r) => r.page),
    [1, 2, 3],
  );
});

test("a bare paginator's own last_page is followed past a clamped page", async () => {
  // Clamped to 25 while 100 was asked for. Only the top-level `last_page`
  // tells the drain that 25 rows is a full page and not the end.
  const rows = Array.from({ length: 60 }, (_, i) => row(i + 1));
  const log: RequestLog = [];

  const result = await fetchAllPages<Row>(stubBarePaginator(rows, log, 25));

  assert.equal(result.rows.length, 60);
  assert.deepEqual(
    log.map((r) => r.page),
    [1, 2, 3],
  );
});

test("a bare array keeps reading, because it proves nothing about more pages", async () => {
  // `api.get` strips `meta` off a real paginator and leaves exactly this, so a
  // full array has to be treated as page 1 of possibly more.
  const rows = Array.from({ length: 150 }, (_, i) => row(i + 1));
  const log: RequestLog = [];
  const api: PageFetcher = async ({ page, per_page }) => {
    log.push({ page, per_page });
    return rows.slice((page - 1) * 100, page * 100);
  };

  const result = await fetchAllPages<Row>(api);

  assert.equal(result.rows.length, 150);
  assert.equal(result.total, null);
  assert.deepEqual(
    log.map((r) => r.page),
    [1, 2],
  );
});

// ── completeRows ───────────────────────────────────────────────────────────

const drainOf = (rows: Row[], extra: Partial<DrainResult<Row>> = {}): DrainResult<Row> => ({
  rows,
  total: rows.length,
  truncated: false,
  pagesFetched: 1,
  ...extra,
});

test("completeRows hands back the rows of a complete drain", () => {
  const rows = [row(1), row(2), row(3)];
  assert.equal(completeRows(drainOf(rows)), rows);
});

test("completeRows throws on a truncated drain instead of returning it short", () => {
  const drain = drainOf([row(1), row(2)], { total: 2400, truncated: true });

  assert.throws(
    () => completeRows(drain),
    (err: unknown) => {
      assert.ok(err instanceof IncompleteListError);
      assert.ok(err instanceof Error, "so every existing catch treats it as a failure");
      assert.equal(err.name, "IncompleteListError");
      assert.equal(err.shown, 2);
      assert.equal(err.total, 2400);
      assert.match(err.message, /Only 2 of 2400 /);
      return true;
    },
  );
});

test("completeRows does not invent a total the server never sent", () => {
  const drain = drainOf([row(1)], { total: null, truncated: true });

  assert.throws(
    () => completeRows(drain),
    (err: unknown) => {
      assert.ok(err instanceof IncompleteListError);
      assert.equal(err.total, null);
      assert.match(err.message, /Only 1 entries .* and more exist/);
      assert.doesNotMatch(err.message, / of /);
      return true;
    },
  );
});

test("completeRows end to end: a runaway paginator fails loudly", async () => {
  const api: PageFetcher = async ({ page }) => ({
    data: [row(page)],
    meta: { current_page: page, last_page: 9999, per_page: 1, total: 9999 },
  });

  await assert.rejects(
    fetchAllPages<Row>(api, { maxPages: 3 }).then(completeRows),
    IncompleteListError,
  );
});
