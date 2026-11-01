import { test } from "node:test";
import assert from "node:assert/strict";
import type { ShareCapitalLedgerEntry, ShareCapitalMemberPeriod } from "@/types";
import { shareCapitalTabView } from "./share-capital-tab-view";

function entry(
  id: number,
  date: string,
  credit: number,
  debit: number,
  running_balance?: number,
): ShareCapitalLedgerEntry {
  return {
    id,
    borrower_id: 7,
    date,
    description: `Entry ${id}`,
    reference: `REF-${id}`,
    credit,
    debit,
    running_balance,
  } as ShareCapitalLedgerEntry;
}

// The server lists newest first. These running balances are deliberately ones
// the browser would never get by adding up the rows: the member holds entries
// on earlier pages that this list does not include.
const serverRows = [
  entry(3, "2026-10-05", 0, 200, 10_300),
  entry(2, "2026-10-05", 500, 0, 10_500),
  entry(1, "2026-09-01", 1_000, 0, 10_000),
];

const summary: ShareCapitalMemberPeriod = {
  opening_balance: 0,
  total_credits: 12_000,
  total_debits: 1_700,
  ending_balance: 10_300,
};

test("each row shows the server's running balance, not a browser sum", () => {
  const { rows } = shareCapitalTabView(serverRows, summary);
  assert.deepEqual(
    rows.map((r) => [r.id, r.runningBalance]),
    [
      [1, 10_000],
      [2, 10_500],
      [3, 10_300],
    ],
  );
});

test("rows read oldest first, the reverse of the server's newest-first list", () => {
  const { rows } = shareCapitalTabView(serverRows, summary);
  assert.deepEqual(rows.map((r) => r.id), [1, 2, 3]);
});

test("the totals are the server's summary, not the rows added up", () => {
  const { totals } = shareCapitalTabView(serverRows, summary);
  assert.deepEqual(totals, { totalCredits: 12_000, totalDebits: 1_700, balance: 10_300 });
});

test("a row without a server running balance shows none rather than an estimate", () => {
  const { rows } = shareCapitalTabView([entry(9, "2026-10-06", 100, 0)], summary);
  assert.equal(rows[0].runningBalance, null);
});

test("without a server summary the totals are unknown, not zero", () => {
  const { totals } = shareCapitalTabView(serverRows, null);
  assert.deepEqual(totals, { totalCredits: null, totalDebits: null, balance: null });
});

test("debit and credit are read as numbers from the server's row", () => {
  const raw = { ...entry(4, "2026-10-07", 0, 0, 50), credit: "250.50", debit: "0.00" };
  const { rows } = shareCapitalTabView([raw as unknown as ShareCapitalLedgerEntry], summary);
  assert.deepEqual([rows[0].credit, rows[0].debit], [250.5, 0]);
});

test("the server's list is not modified", () => {
  const copy = [...serverRows];
  shareCapitalTabView(serverRows, summary);
  assert.deepEqual(serverRows, copy);
});
