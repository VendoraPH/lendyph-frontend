import { test } from "node:test";
import assert from "node:assert/strict";
import { collectReportPages, REPORT_MAX_PER_PAGE } from "./report.service";

/**
 * Builds a fake report endpoint over `rows`, paginated the way
 * ReportController::listOfDuePastDue() does: `{ data, totals, meta }` with
 * `meta.last_page` derived from the row count.
 */
function paginator(rows: unknown[], perPage: number) {
  const calls: number[] = [];
  const lastPage = Math.max(1, Math.ceil(rows.length / perPage));
  return {
    calls,
    fetchPage: async (page: number) => {
      calls.push(page);
      return {
        data: rows.slice((page - 1) * perPage, page * perPage),
        meta: {
          current_page: page,
          last_page: lastPage,
          per_page: perPage,
          total: rows.length,
        },
      };
    },
  };
}

const rows = (n: number, offset = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: offset + i + 1 }));

test("REPORT_MAX_PER_PAGE stays within the server's max:1000 validation", () => {
  // reportFilters() rejects rather than clamps, so exceeding this is a 422 and
  // an empty screen, not a short page.
  assert.ok(REPORT_MAX_PER_PAGE >= 1 && REPORT_MAX_PER_PAGE <= 1000);
  assert.ok(Number.isInteger(REPORT_MAX_PER_PAGE));
});

test("collects every row across page boundaries, in order", async () => {
  const all = rows(2263);
  const { fetchPage, calls } = paginator(all, 1000);

  const res = await collectReportPages(fetchPage);

  assert.equal(res.rows.length, 2263);
  assert.equal(res.total, 2263);
  assert.equal(res.pagesFetched, 3);
  assert.equal(res.complete, true);
  assert.deepEqual(calls, [1, 2, 3]);
  // Order preserved end to end — the last row of the set is the last row here.
  assert.deepEqual(res.rows[0], { id: 1 });
  assert.deepEqual(res.rows[2262], { id: 2263 });
});

test("a single full page still stops after one request", async () => {
  const { fetchPage, calls } = paginator(rows(1000), 1000);
  const res = await collectReportPages(fetchPage);
  assert.equal(res.rows.length, 1000);
  assert.deepEqual(calls, [1]);
  assert.equal(res.complete, true);
});

test("an empty report is one request and not a failure", async () => {
  const { fetchPage, calls } = paginator([], 1000);
  const res = await collectReportPages(fetchPage);
  assert.deepEqual(res.rows, []);
  assert.equal(res.total, 0);
  assert.equal(res.complete, true);
  assert.deepEqual(calls, [1]);
});

test("reports progress after each page", async () => {
  const { fetchPage } = paginator(rows(2263), 1000);
  const seen: Array<[number, number | null]> = [];

  await collectReportPages(fetchPage, {
    onProgress: (loaded, total) => seen.push([loaded, total]),
  });

  assert.deepEqual(seen, [
    [1000, 2263],
    [2000, 2263],
    [2263, 2263],
  ]);
});

// ── Termination guards ──
//
// `last_page` is a number the server supplies, so the loop cannot trust it.

test("stops at maxPages and flags the result partial", async () => {
  // A server that always claims one more page than it has served.
  let served = 0;
  const fetchPage = async (page: number) => {
    served += 1;
    return {
      data: rows(10, (page - 1) * 10),
      meta: { current_page: page, last_page: 999_999, total: 9_999_999 },
    };
  };

  const res = await collectReportPages(fetchPage, { maxPages: 5 });

  assert.equal(res.complete, false, "must not claim a complete set");
  assert.equal(served, 5, "must stop at the cap rather than spin");
  assert.equal(res.rows.length, 50);
});

test("stops when the server claims more pages but serves no rows", async () => {
  let served = 0;
  const fetchPage = async (page: number) => {
    served += 1;
    return { data: [], meta: { current_page: page, last_page: 500, total: 5000 } };
  };

  const res = await collectReportPages(fetchPage, { maxPages: 25 });

  assert.equal(served, 1, "an empty page while more are claimed ends the walk");
  assert.equal(res.complete, false);
  assert.deepEqual(res.rows, []);
  assert.equal(res.pagesFetched, 1, "the page that was fetched is counted");
});

test("a response with no meta is treated as the whole set", async () => {
  let served = 0;
  const fetchPage = async () => {
    served += 1;
    return { data: rows(3) };
  };

  const res = await collectReportPages(fetchPage);

  assert.equal(served, 1);
  assert.equal(res.rows.length, 3);
  assert.equal(res.total, null);
  assert.equal(res.complete, true);
});

test("garbage last_page values cannot drive the loop", async () => {
  for (const lastPage of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, "3", null]) {
    let served = 0;
    const fetchPage = async (page: number) => {
      served += 1;
      return { data: rows(2), meta: { current_page: page, last_page: lastPage } };
    };

    const res = await collectReportPages(fetchPage);

    assert.equal(served, 1, `last_page=${String(lastPage)} must not page further`);
    assert.equal(res.rows.length, 2);
  }
});

test("bare-array and double-wrapped bodies still yield rows", async () => {
  const bare = await collectReportPages(async () => rows(4));
  assert.equal(bare.rows.length, 4);

  const doubled = await collectReportPages(async () => ({ data: { data: rows(6) } }));
  assert.equal(doubled.rows.length, 6);
});

test("a rejected page propagates instead of returning a silent partial set", async () => {
  const err = Object.assign(new Error("Request failed with status code 422"), {
    response: {
      status: 422,
      data: { errors: { per_page: ["The per page field must not be greater than 1000."] } },
    },
  });

  await assert.rejects(
    () =>
      collectReportPages(async (page) => {
        if (page === 1) throw err;
        return { data: [] };
      }),
    /422/,
  );
});

// ── The regression this fix exists for ──

test("aggregating a loan whose schedules straddle a page boundary", async () => {
  // One loan with three unpaid periods, ordered by due_date like
  // duePastDueQuery() — so they land on different pages.
  const all = [
    ...rows(999),
    { id: 1000, loan_id: 77, days_past_due: 120, principal_due: 100 },
    { id: 1001, loan_id: 77, days_past_due: 90, principal_due: 100 },
    ...rows(500, 1001),
    { id: 1502, loan_id: 77, days_past_due: 30, principal_due: 100 },
  ];

  const { fetchPage } = paginator(all, 1000);
  const res = await collectReportPages(fetchPage);

  const mine = res.rows.filter(
    (r): r is { loan_id: number; days_past_due: number; principal_due: number } =>
      typeof r === "object" && r !== null && "loan_id" in r,
  );

  assert.equal(mine.length, 3, "all three periods survive the page boundary");
  assert.equal(Math.max(...mine.map((r) => r.days_past_due)), 120);
  assert.equal(
    mine.reduce((s, r) => s + r.principal_due, 0),
    300,
    "a one-page fetch would have summed only 100 of this loan's 300",
  );
});
