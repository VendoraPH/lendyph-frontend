import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHARE_CAPITAL_UNAVAILABLE_LABEL,
  hasShareCapitalBalance,
  ledgerAmounts,
  shareCapitalUnavailableReason,
  toShareCapitalBalance,
} from "./share-capital";
import { fetchAllPages, type PageFetcher } from "@/lib/paginate";
import type { DrainResult } from "@/lib/paginate";
import type { ShareCapitalLedgerEntry } from "@/types";

type Entry = ShareCapitalLedgerEntry;

let nextId = 0;
/** One `ShareCapitalLedgerResource` row: the amount sits in one column, the other is 0. */
const entry = (side: "credit" | "debit", amount: number): Entry => {
  const id = ++nextId;
  return {
    id,
    borrower_id: 7,
    borrower_name: "Juana Dela Cruz",
    borrower_code: "MBR-0001",
    date: "2026-01-01",
    description: side === "credit" ? "Monthly contribution" : "Partial withdrawal",
    reference: `SC-20260101-${String(id).padStart(6, "0")}`,
    debit: side === "debit" ? amount : 0,
    credit: side === "credit" ? amount : 0,
    created_by_user: { id: 1, name: "Carlo Uy" },
    created_at: "2026-01-01T01:00:00.000000Z",
  };
};

const drain = (rows: Entry[], over: Partial<DrainResult<Entry>> = {}): DrainResult<Entry> => ({
  rows,
  total: rows.length,
  truncated: false,
  pagesFetched: 1,
  ...over,
});

/**
 * A stand-in for `ShareCapitalLedgerController::index()`, reproducing the one
 * behaviour that caused this bug: `per_page` is silently clamped to 100 rather
 * than rejected, in a response whose shape is indistinguishable from a
 * complete one.
 */
function stubLedger(rows: Entry[], maxPerPage = 100): PageFetcher {
  return async ({ page, per_page }) => {
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

// ---------------------------------------------------------------------------
// The wire shape
// ---------------------------------------------------------------------------

test("a ledger exactly as the API serialises it sums to credits minus debits", () => {
  // Verbatim `ShareCapitalLedgerResource` rows, newest first as the controller
  // orders them. The entry type used to declare `type` + `amount`, neither of
  // which the API sends, so this ledger — and every other — read ₱0.
  const rows = JSON.parse(`[
    {"id":3,"borrower_id":7,"borrower_name":"Juana Dela Cruz","borrower_code":"MBR-0001","date":"2026-03-10","description":"Partial withdrawal","reference":"SC-20260310-000001","debit":200,"credit":0,"created_by_user":{"id":1,"name":"Carlo Uy"},"created_at":"2026-03-10T02:15:00.000000Z"},
    {"id":2,"borrower_id":7,"borrower_name":"Juana Dela Cruz","borrower_code":"MBR-0001","date":"2026-02-15","description":"Monthly contribution","reference":"SC-20260215-000001","debit":0,"credit":500,"created_by_user":{"id":1,"name":"Carlo Uy"},"created_at":"2026-02-15T01:04:00.000000Z"},
    {"id":1,"borrower_id":7,"borrower_name":"Juana Dela Cruz","borrower_code":"MBR-0001","date":"2026-01-15","description":"Monthly contribution","reference":"SC-20260115-000001","debit":0,"credit":500,"created_by_user":{"id":1,"name":"Carlo Uy"},"created_at":"2026-01-15T01:02:00.000000Z"}
  ]`) as Entry[];

  const result = toShareCapitalBalance(drain(rows));

  assert.equal(result.status, "ok");
  assert.equal(hasShareCapitalBalance(result) && result.balance, 800);
  assert.equal(hasShareCapitalBalance(result) && result.entries, 3);
});

test("a ledger that has paid out more than it took in stays negative", () => {
  const result = toShareCapitalBalance(drain([entry("credit", 500), entry("debit", 800)]));
  assert.equal(hasShareCapitalBalance(result) && result.balance, -300);
});

// ---------------------------------------------------------------------------
// The bug, in both directions
// ---------------------------------------------------------------------------

/**
 * These two are the whole argument for the result type.
 *
 * A clamped ledger drops credits AND debits, so the resulting balance is wrong
 * in EITHER direction depending only on the order the rows happen to arrive in
 * — and the controller orders `date DESC, id DESC`, which nobody controls.
 * "It errs low, so it fails safe" is not available as a defence.
 */
test("a clamped ledger reads TOO LOW when the newest page holds the debits", async () => {
  // 140 old credits + 60 newer credits + 40 newest debits = 240 entries.
  // Newest-first, so page 1 is 60 credits and 40 debits.
  const newest = [
    ...Array.from({ length: 40 }, () => entry("debit", 500)),
    ...Array.from({ length: 60 }, () => entry("credit", 1000)),
  ];
  const rows = [...newest, ...Array.from({ length: 140 }, () => entry("credit", 1000))];

  const onePage = await stubLedger(rows)({ page: 1, per_page: 9999 });
  const clamped = toShareCapitalBalance(
    drain((onePage as { data: Entry[] }).data, { total: rows.length }),
  );
  const whole = toShareCapitalBalance(await fetchAllPages<Entry>(stubLedger(rows)));

  assert.equal(clamped.status, "ok"); // looks complete — that is the problem
  assert.equal(hasShareCapitalBalance(clamped) && clamped.balance, 40_000);
  assert.equal(hasShareCapitalBalance(whole) && whole.balance, 180_000);
  assert.equal(hasShareCapitalBalance(whole) && whole.entries, 240);
});

test("a clamped ledger reads TOO HIGH when the debits are older than the cap", async () => {
  // Newest 100 credits, oldest 50 debits = 150 entries.
  const rows = [
    ...Array.from({ length: 100 }, () => entry("credit", 1000)),
    ...Array.from({ length: 50 }, () => entry("debit", 1500)),
  ];

  const onePage = await stubLedger(rows)({ page: 1, per_page: 9999 });
  const clamped = toShareCapitalBalance(
    drain((onePage as { data: Entry[] }).data, { total: rows.length }),
  );
  const whole = toShareCapitalBalance(await fetchAllPages<Entry>(stubLedger(rows)));

  assert.equal(hasShareCapitalBalance(clamped) && clamped.balance, 100_000);
  assert.equal(hasShareCapitalBalance(whole) && whole.balance, 25_000);
});

test("the drain asks for the documented ceiling, not a guess above it", async () => {
  const log: number[] = [];
  const rows = Array.from({ length: 240 }, () => entry("credit", 1000));
  const inner = stubLedger(rows);
  await fetchAllPages<Entry>(async (params) => {
    log.push(params.per_page);
    return inner(params);
  });
  assert.deepEqual(log, [100, 100, 100]);
});

// ---------------------------------------------------------------------------
// Refusing to decide
// ---------------------------------------------------------------------------

test("a truncated drain refuses to report a balance at all", () => {
  const result = toShareCapitalBalance(
    drain(Array.from({ length: 2000 }, () => entry("credit", 1000)), {
      truncated: true,
      total: 5000,
    }),
  );

  assert.equal(result.status, "incomplete");
  // No `balance` key to fall back on — a caller cannot `?? 0` its way back to
  // the bug.
  assert.equal("balance" in result, false);
  assert.equal(result.status === "incomplete" && result.shown, 2000);
  assert.equal(result.status === "incomplete" && result.total, 5000);
});

test("an incomplete drain with no usable total still refuses, without inventing one", () => {
  const result = toShareCapitalBalance(
    drain([entry("credit", 1000)], { truncated: true, total: null }),
  );
  assert.equal(result.status, "incomplete");
  assert.match(shareCapitalUnavailableReason(result) ?? "", /^Only 1 share capital entries/);
});

test("an empty ledger is a real zero, and says so", () => {
  const result = toShareCapitalBalance(drain([], { total: 0 }));
  assert.equal(result.status, "ok");
  assert.equal(hasShareCapitalBalance(result) && result.balance, 0);
  assert.equal(shareCapitalUnavailableReason(result), null);
});

test("a genuine zero is distinguishable from a failure to read the ledger", () => {
  const real = toShareCapitalBalance(drain([entry("credit", 500), entry("debit", 500)]));
  const failed = { status: "unavailable" } as const;

  assert.equal(hasShareCapitalBalance(real) && real.balance, 0);
  assert.equal(hasShareCapitalBalance(failed), false);
  // The old signature collapsed these two into the same `0`, which is how a
  // network blip became "this member has no share capital".
  assert.notEqual(real.status, failed.status);
  assert.match(shareCapitalUnavailableReason(failed) ?? "", /not the same as zero/);
});

// ---------------------------------------------------------------------------
// Arithmetic hygiene
// ---------------------------------------------------------------------------

test("unparseable amounts are skipped rather than poisoning the total with NaN", () => {
  const rows = [
    entry("credit", 1000),
    { ...entry("credit", 0), credit: "not a number" as unknown as number },
    { ...entry("debit", 0), debit: undefined as unknown as number },
    entry("debit", 250),
  ];
  const result = toShareCapitalBalance(drain(rows));
  assert.equal(hasShareCapitalBalance(result) && result.balance, 750);
});

test("a bad column counts as 0 without discarding the other side of the entry", () => {
  assert.deepEqual(
    ledgerAmounts({ debit: 100, credit: "not a number" as unknown as number }),
    { debit: 100, credit: 0 },
  );
  assert.deepEqual(
    ledgerAmounts({ debit: Number.NaN, credit: 300 }),
    { debit: 0, credit: 300 },
  );
});

test("a non-finite total is reported as unknown, never as 0", () => {
  const rows = [entry("credit", Number.MAX_VALUE), entry("credit", Number.MAX_VALUE)];
  const result = toShareCapitalBalance(drain(rows));
  assert.equal(result.status, "unavailable");
});

test("string amounts off the wire still add up", () => {
  const rows = [
    { ...entry("credit", 0), credit: "1500.50" as unknown as number },
    { ...entry("debit", 0), debit: "500.25" as unknown as number },
  ];
  const result = toShareCapitalBalance(drain(rows));
  assert.equal(hasShareCapitalBalance(result) && result.balance, 1000.25);
});

test("every screen refusing to decide says the same words", () => {
  assert.equal(SHARE_CAPITAL_UNAVAILABLE_LABEL, "Balance unavailable");
});
