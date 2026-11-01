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
import type { ShareCapitalLedgerEntry, ShareCapitalMemberPeriod } from "@/types";

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

const period = (ending_balance: number): ShareCapitalMemberPeriod => ({
  opening_balance: 0,
  total_credits: 0,
  total_debits: 0,
  ending_balance,
});

// ---------------------------------------------------------------------------
// The server's balance (`meta.summary.ending_balance`), never a browser sum
// ---------------------------------------------------------------------------

test("the balance is the server's ending balance, as sent", () => {
  // Not credits minus debits of anything in hand: the server's figure covers
  // the member's whole ledger, whatever page the list stopped at.
  const result = toShareCapitalBalance(period(183_456.78));
  assert.equal(result.status, "ok");
  assert.equal(hasShareCapitalBalance(result) && result.balance, 183_456.78);
});

test("a ledger that has paid out more than it took in stays negative", () => {
  const result = toShareCapitalBalance(period(-300));
  assert.equal(hasShareCapitalBalance(result) && result.balance, -300);
});

test("a zero ending balance is a real zero, and says so", () => {
  const result = toShareCapitalBalance(period(0));
  assert.equal(result.status, "ok");
  assert.equal(hasShareCapitalBalance(result) && result.balance, 0);
  assert.equal(shareCapitalUnavailableReason(result), null);
});

test("no summary from the server is unavailable, never 0", () => {
  for (const summary of [null, undefined]) {
    const result = toShareCapitalBalance(summary);
    assert.equal(result.status, "unavailable");
    // No `balance` key to fall back on: a caller cannot `?? 0` its way to a
    // member with "no share capital".
    assert.equal("balance" in result, false);
    assert.match(shareCapitalUnavailableReason(result) ?? "", /not the same as zero/);
  }
});

test("a string ending balance off the wire is read as its number", () => {
  const result = toShareCapitalBalance({
    ...period(0),
    ending_balance: "1000.25" as unknown as number,
  });
  assert.equal(hasShareCapitalBalance(result) && result.balance, 1000.25);
});

test("an unreadable ending balance is unavailable, never 0", () => {
  for (const bad of ["not a number", null, Number.POSITIVE_INFINITY]) {
    const result = toShareCapitalBalance({
      ...period(0),
      ending_balance: bad as unknown as number,
    });
    assert.equal(result.status, "unavailable");
  }
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

test("every screen refusing to decide says the same words", () => {
  assert.equal(SHARE_CAPITAL_UNAVAILABLE_LABEL, "Balance unavailable");
});
