import { test } from "node:test";
import assert from "node:assert/strict";
import { ledgerInterestPaid, ledgerOpening, walkLedgerBalances } from "./ledger-balances";

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

// ── Voided repayments ───────────────────────────────────────────────────────
//
// The server reverses a voided payment, so the Ledger keeps showing it (struck
// through) but it moves no balance. Counting it put its interest into the
// opening — every row before it too high by exactly that — and took its
// principal off the walk, so it and every later row read too low.

const OPENING = {
  principalAmount: 10000,
  scheduleRowCount: 3,
  currentInterestDue: 250,
  scheduleScbTotal: 300,
  interestDebits: 250,
  interestCredits: 250,
};

const REPAYMENTS = [
  { id: 1, interest_paid: 250, status: "completed" as const },
  { id: 2, interest_paid: 250, status: "completed" as const },
];
const VOIDED_REPAYMENT = { id: 3, interest_paid: 400, status: "voided" as const };
const VOIDED_ROW = {
  key: "repayment-3",
  principalPaid: 1500,
  interestCredit: 400,
  scbPaid: 50,
  status: "voided",
};

test("a voided repayment's interest adds nothing to the interest paid", () => {
  assert.equal(ledgerInterestPaid(REPAYMENTS), 500);
  assert.equal(ledgerInterestPaid([...REPAYMENTS, VOIDED_REPAYMENT]), 500);
  assert.equal(ledgerInterestPaid([VOIDED_REPAYMENT]), 0);
  assert.equal(ledgerInterestPaid([{ status: "completed" }]), 0);
});

test("a voided interest payment leaves the opening and earlier rows unchanged", () => {
  const without = ledgerOpening({ ...OPENING, interestPaid: ledgerInterestPaid(REPAYMENTS) });
  const withVoid = ledgerOpening({
    ...OPENING,
    interestPaid: ledgerInterestPaid([...REPAYMENTS, VOIDED_REPAYMENT]),
  });
  assert.deepEqual(withVoid, without);
  assert.deepEqual(withVoid, { principal: 10000, interest: 750, scb: 300 });

  const rows = walkLedgerBalances([ROWS[0], ROWS[1], ROWS[2], VOIDED_ROW, ROWS[3]], withVoid);
  assert.deepEqual(
    rows.map((r) => [r.key, r.principalBal, r.interestBal, r.scbBal]),
    [
      ["repayment-1", 9000, 500, 200],
      ["ledger-1", 9000, 750, 200],
      ["ledger-2", 9000, 500, 200],
      // The voided row carries the balances through unchanged.
      ["repayment-3", 9000, 500, 200],
      ["repayment-2", 8000, 250, 200],
    ],
  );
});

test("a voided principal payment leaves later principal and SCB balances unchanged", () => {
  const opening = ledgerOpening({ ...OPENING, interestPaid: ledgerInterestPaid(REPAYMENTS) });
  const rows = walkLedgerBalances([VOIDED_ROW, ...ROWS], opening);
  assert.deepEqual(rows.map((r) => r.principalBal), [10000, 9000, 9000, 9000, 8000]);
  assert.deepEqual(rows.map((r) => r.scbBal), [300, 200, 200, 200, 200]);
});

test("with a voided repayment the last row still lands on what is owed", () => {
  for (const position of [0, 2, 4]) {
    const walked = [...ROWS] as (typeof ROWS[number] | typeof VOIDED_ROW)[];
    walked.splice(position, 0, VOIDED_ROW);
    const rows = walkLedgerBalances(
      walked,
      ledgerOpening({
        ...OPENING,
        interestPaid: ledgerInterestPaid([...REPAYMENTS, VOIDED_REPAYMENT]),
      }),
    );
    assert.equal(rows[rows.length - 1].interestBal, OPENING.currentInterestDue, `voided at ${position}`);
  }
});

test("a voided row keeps its own amounts for the struck-through display", () => {
  const [row] = walkLedgerBalances([VOIDED_ROW], { principal: 10000, interest: 250, scb: 300 });
  assert.equal(row.principalPaid, 1500);
  assert.equal(row.interestCredit, 400);
  assert.equal(row.scbPaid, 50);
  assert.equal(row.status, "voided");
});
