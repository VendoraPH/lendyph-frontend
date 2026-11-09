/**
 * The dashboard's Recent Transactions, as GET /dashboard/recent-transactions
 * sends them.
 *
 * WHAT THIS PROVES: the rows keep the server's order (newest first, across
 * payments, releases and restructures), are never re-sorted or grouped, the
 * first 10 are shown, every row has its own key even when two sources share an
 * id, and an amount the server didn't send reads as a dash (null), never ₱0.00.
 * WHAT IT DOES NOT PROVE: the order itself (backend tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { recentTransactionRows } from "./recent-transactions";

const SERVER = [
  { type: "payment", id: 7, borrower_name: "Ana Cruz", description: "Payment via Cash", amount: 1500, date: "Nov 10, 3:15 PM" },
  { type: "release", id: 7, borrower_name: "Ben Reyes", description: "Loan released", amount: 18500, date: "Nov 10, 9:02 AM" },
  { type: "payment", id: 6, borrower_name: "Ana Cruz", description: "Payment via GCash", amount: "250.50", date: "Nov 9, 4:40 PM" },
  { type: "restructure", id: 5, borrower_name: "Carla Dizon", description: "Loan restructured", amount: 0, date: "Nov 1, 8:00 AM" },
];

test("keeps the server's order, never re-sorting by name, amount, type or date text", () => {
  const rows = recentTransactionRows({ data: SERVER });
  assert.deepEqual(
    rows.map((r) => [r.name, r.desc, r.date]),
    [
      ["Ana Cruz", "Payment via Cash", "Nov 10, 3:15 PM"],
      ["Ben Reyes", "Loan released", "Nov 10, 9:02 AM"],
      ["Ana Cruz", "Payment via GCash", "Nov 9, 4:40 PM"],
      ["Carla Dizon", "Loan restructured", "Nov 1, 8:00 AM"],
    ],
  );
  // A bare array reads the same way.
  assert.deepEqual(recentTransactionRows(SERVER), rows);
});

test("every row has its own key, even when a payment and a release share an id", () => {
  const keys = recentTransactionRows({ data: SERVER }).map((r) => r.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("shows the first 10 rows as sent", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ borrower_name: `M${i}`, amount: i, date: `d${i}` }));
  const rows = recentTransactionRows({ data: many });
  assert.equal(rows.length, 10);
  assert.deepEqual(rows.map((r) => r.name), many.slice(0, 10).map((m) => m.borrower_name));
});

test("amounts are the server's: 0 stays 0, a missing one is null", () => {
  const rows = recentTransactionRows({ data: [{ amount: 0 }, { amount: "250.50" }, {}, { amount: null }] });
  assert.deepEqual(rows.map((r) => r.amount), [0, 250.5, null, null]);
});

test("nothing readable is an empty list", () => {
  assert.deepEqual(recentTransactionRows(null), []);
  assert.deepEqual(recentTransactionRows({}), []);
  assert.deepEqual(recentTransactionRows({ data: "x" }), []);
});

test("the dashboard renders the rows as built, with no sort of its own", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/dashboard/page.tsx"), "utf8");
  assert.ok(page.includes("recentTransactionRows(res)"));
  assert.ok(page.includes("<TableRow key={tx.key}"));
  assert.ok(page.includes("currencyOrDash(tx.amount)"));
  assert.doesNotMatch(page, /transactions\s*\.\s*(sort|toSorted|reverse)\(/);
  assert.doesNotMatch(page, /recentTransactions\s*\.\s*(sort|toSorted|reverse)\(/);
});
