import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MAX_PAGES,
  MAX_PER_PAGE,
  fetchAllPages,
  type PageFetcher,
} from "./paginate";
import { toBorrowerPayments, toLoanRepayments, withBreakdown } from "./repayment-list";
import type { Repayment } from "@/types";

type RequestLog = { page: number; per_page: number }[];

/** What `RepaymentController::index()` serves when the client sends no `per_page`. */
const SERVER_DEFAULT_PER_PAGE = 15;

/** `YYYY-MM-DD`, `n` days after 2026-01-01, built from UTC parts. */
function day(n: number): string {
  const d = new Date(Date.UTC(2026, 0, 1 + n));
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * A payment as `RepaymentResource` serialises it — on the list and the detail
 * endpoint alike: the allocation under `*_applied` and its `*_amount` / bare
 * aliases, and no `*_paid`, `scb_*` or `excess_amount` at all.
 */
function wireRow(id: number): Repayment {
  const principal = 400 + (id % 7);
  const interest = 100 + (id % 3);
  const penalty = id % 5 === 0 ? 25 : 0;
  return {
    id,
    loan_id: 1,
    payment_date: day(id),
    paid_at: day(id),
    amount_paid: principal + interest + penalty,
    amount: principal + interest + penalty,
    principal_applied: principal,
    principal_amount: principal,
    principal,
    interest_applied: interest,
    interest_amount: interest,
    interest,
    penalty_applied: penalty,
    penalty_amount: penalty,
    penalty,
    overpayment: 0,
    receipt_number: `OR-${id}`,
    status: "completed",
    created_at: `${day(id)} 09:00:00`,
    updated_at: `${day(id)} 09:00:00`,
  } as unknown as Repayment;
}

const seed = (count: number) => Array.from({ length: count }, (_, i) => wireRow(i + 1));
const alias = (r: Repayment, key: string) => (r as unknown as Record<string, number>)[key];

/**
 * `RepaymentController::index()` as far as the drain can see it: `per_page`
 * defaults to 15 and is clamped to 100 without a word, rows come OLDEST first
 * (the relation's `orderBy('payment_date')` outranks the controller's
 * `latest()`), and pages past the end come back empty.
 */
function stubLoanRepayments(rows: Repayment[], log: RequestLog, served: number[] = []): PageFetcher {
  return async ({ page, per_page }) => {
    log.push({ page, per_page });
    const perPage = Math.min(per_page || SERVER_DEFAULT_PER_PAGE, 100);
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

/**
 * What `fetchRepayments` did to every row before this change, verbatim: fetch
 * the row's detail, then merge. The detail endpoint serialises the same
 * resource, so `detail` here is the row itself.
 */
function oldEnrich(r: Repayment, detail: Repayment): Repayment {
  const d = detail as Repayment & Record<string, unknown>;
  return {
    ...r,
    ...detail,
    principal_paid: (detail.principal_paid ?? (d.principal_amount as number)) || undefined,
    interest_paid: (detail.interest_paid ?? (d.interest_amount as number)) || undefined,
    scb_paid: (detail.scb_paid ?? (d.scb_amount as number)) || undefined,
    penalty_paid: (detail.penalty_paid ?? (d.penalty_amount as number)) || undefined,
  } as Repayment;
}

const sum = (rows: Repayment[], key: keyof Repayment) =>
  rows.reduce((s, r) => s + ((r[key] as number | undefined) ?? 0), 0);

// ── The drain ──────────────────────────────────────────────────────────────

test("a daily loan's 237 payments drain in three pages of 100 + 100 + 37, the newest included", async () => {
  const log: RequestLog = [];
  const served: number[] = [];

  const { rows, shortfall } = toLoanRepayments(
    await fetchAllPages<Repayment>(stubLoanRepayments(seed(237), log, served)),
  );

  assert.deepEqual(served, [100, 100, 37]);
  assert.equal(log.length, Math.ceil(237 / MAX_PER_PAGE), "ceil(N / 100) requests, and nothing per row");
  assert.ok(log.every((r) => r.per_page === MAX_PER_PAGE), "asks for the ceiling each time");
  assert.equal(rows.length, 237);
  assert.equal(shortfall, null, "a complete history is not a shortfall");
  assert.equal(new Set(rows.map((r) => r.id)).size, 237, "no page overlap or gap");
  assert.equal(rows.at(-1)?.payment_date, day(237), "the newest payment sits on page 3 — and arrives");
});

/**
 * The bug, stated as a test: one default page of an oldest-first list is a
 * ledger that stops three weeks after release.
 */
test("REGRESSION: one default page was the OLDEST 15, so the ledger lost every newer payment", async () => {
  const all = seed(237);
  const api = stubLoanRepayments(all, []);

  // What `repaymentService.list(id)` received.
  const onePage = ((await api({ page: 1, per_page: SERVER_DEFAULT_PER_PAGE })) as { data: Repayment[] }).data;
  assert.deepEqual(
    onePage.map((r) => r.id),
    Array.from({ length: 15 }, (_, i) => i + 1),
    "the first fifteen payments ever made, and nothing after them",
  );
  const oldLedger = onePage.map((r) => oldEnrich(r, r));
  const principalPaid = all.reduce((s, r) => s + alias(r, "principal_amount"), 0);

  const { rows } = toLoanRepayments(await fetchAllPages<Repayment>(api));
  assert.equal(sum(rows, "principal_paid"), principalPaid, "every peso of principal is on the ledger");
  assert.ok(
    sum(oldLedger, "principal_paid") < principalPaid / 10,
    "the old ledger ran its principal balance down on a sixteenth of what was paid",
  );
});

test("a truncated drain is reported as a shortfall, with the server's total", async () => {
  const log: RequestLog = [];
  const count = DEFAULT_MAX_PAGES * MAX_PER_PAGE + 37;

  const { rows, shortfall } = toLoanRepayments(
    await fetchAllPages<Repayment>(stubLoanRepayments(seed(count), log)),
  );

  assert.equal(log.length, DEFAULT_MAX_PAGES);
  assert.equal(rows.length, DEFAULT_MAX_PAGES * MAX_PER_PAGE);
  assert.deepEqual(shortfall, { shown: DEFAULT_MAX_PAGES * MAX_PER_PAGE, total: count });
});

// ── What each row reads as ─────────────────────────────────────────────────

test("each row reads exactly as the per-row detail enrichment made it — with no request behind it", () => {
  const rows = seed(237);
  // The enrichment merged each row with a detail that IS the row, so mapping
  // the row on its own must come out identical, field for field.
  assert.deepEqual(
    rows.map(withBreakdown),
    rows.map((r) => oldEnrich(r, r)),
  );
});

test("the breakdown comes from the `*_amount` aliases every list row carries", () => {
  const row = withBreakdown(wireRow(10));
  assert.equal(row.principal_paid, alias(wireRow(10), "principal_amount"));
  assert.equal(row.interest_paid, alias(wireRow(10), "interest_amount"));
  assert.equal(row.penalty_paid, 25);
  assert.equal(withBreakdown(wireRow(1)).penalty_paid, undefined, "a zero reads as not recorded, as before");
});

test("SCB stays blank — no endpoint serves an SCB split — and a `*_paid` value would win if one ever did", () => {
  assert.equal(withBreakdown(wireRow(3)).scb_paid, undefined);
  const served = withBreakdown({ ...wireRow(3), principal_paid: 999, scb_paid: 50 } as Repayment);
  assert.equal(served.principal_paid, 999);
  assert.equal(served.scb_paid, 50);
});

// ── A member's payments ────────────────────────────────────────────────────

test("a member's drained payments are the real count; a truncated drain says it is short", () => {
  const whole = toBorrowerPayments({ rows: seed(280), total: 280, truncated: false, pagesFetched: 3 });
  assert.equal(whole.payments.length, 280);
  assert.equal(whole.shortfall, null);

  const short = toBorrowerPayments({ rows: seed(2000), total: 2100, truncated: true, pagesFetched: 20 });
  assert.deepEqual(short.shortfall, { shown: 2000, total: 2100 });
});
