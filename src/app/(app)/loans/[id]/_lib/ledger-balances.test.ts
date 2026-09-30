import { test } from "node:test";
import assert from "node:assert/strict";
import { ledgerOpening, walkLedgerBalances } from "./ledger-balances";

/**
 * A one-month loan extended once with "pay": two repayments that each paid
 * ₱250 interest, and the extension's ₱250 debit and its ₱250 credit.
 */
const ROWS = [
  { key: "repayment-1", principalPaid: 1000, interestCredit: 250, scbPaid: 100 },
  { key: "ledger-1", interestDebit: 250 },
  { key: "ledger-2", interestCredit: 250 },
  { key: "repayment-2", principalPaid: 1000, interestCredit: 250 },
];
const MOVEMENTS = { interestDebits: 250, interestCredits: 250, interestPaid: 500 };

test("with schedule rows, interest opens where the walk lands on what is owed", () => {
  const opening = ledgerOpening({
    principalAmount: 10000,
    scheduleRowCount: 3,
    currentInterestDue: 250,
    scheduleScbTotal: 300,
    ...MOVEMENTS,
  });
  // 250 owed − 250 debited + 250 credited + 500 paid.
  assert.deepEqual(opening, { principal: 10000, interest: 750, scb: 300 });

  const rows = walkLedgerBalances(ROWS, opening);
  assert.deepEqual(
    rows.map((r) => [r.key, r.principalBal, r.interestBal, r.scbBal]),
    [
      ["repayment-1", 9000, 500, 200],
      ["ledger-1", 9000, 750, 200],
      ["ledger-2", 9000, 500, 200],
      ["repayment-2", 8000, 250, 200],
    ],
  );
});

test("an empty server schedule leaves the Interest balance unknown on every row", () => {
  // LA-000002 on staging: restructured, `[]` from the server, so nothing is
  // owed today but nothing says what was owed at release. Walking from 0 took
  // the balance to −₱250, −₱500 as the interest collections posted.
  const opening = ledgerOpening({
    principalAmount: 10000,
    scheduleRowCount: 0,
    currentInterestDue: 0,
    scheduleScbTotal: 0,
    ...MOVEMENTS,
  });
  assert.deepEqual(opening, { principal: 10000, interest: null, scb: null });

  const rows = walkLedgerBalances(ROWS, opening);
  assert.deepEqual(
    rows.map((r) => r.interestBal),
    [null, null, null, null],
  );
  assert.deepEqual(
    rows.map((r) => r.scbBal),
    [null, null, null, null],
  );
});

test("with no schedule, the server's own amounts and the principal walk are kept", () => {
  const rows = walkLedgerBalances(
    ROWS,
    ledgerOpening({
      principalAmount: 10000,
      scheduleRowCount: 0,
      currentInterestDue: 0,
      scheduleScbTotal: 0,
      ...MOVEMENTS,
    }),
  );
  // Principal opens at the loan's principal, which no schedule is needed for.
  assert.deepEqual(rows.map((r) => r.principalBal), [9000, 9000, 9000, 8000]);
  // Debits, credits and payments are facts the server recorded; untouched.
  rows.forEach((row, i) => {
    for (const [field, value] of Object.entries(ROWS[i])) {
      assert.equal(row[field as keyof typeof row], value, `${row.key} ${field}`);
    }
  });
});

test("a schedule still loading, or unreadable, is unknown too", () => {
  assert.deepEqual(
    ledgerOpening({
      principalAmount: 10000,
      scheduleRowCount: 0,
      currentInterestDue: null,
      scheduleScbTotal: 0,
      ...MOVEMENTS,
    }),
    { principal: 10000, interest: null, scb: null },
  );
});

test("no ledger rows walk to no balances", () => {
  assert.deepEqual(
    walkLedgerBalances([], { principal: 10000, interest: 250, scb: 300 }),
    [],
  );
});
