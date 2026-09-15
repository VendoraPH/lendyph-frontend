import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPosting, settlementAccountId } from "./posting-rules";
import { sumCentavos } from "./money";
import type { AccountMapping } from "@/types/accounting";

/** Ids are arbitrary; only that the right one is picked matters. */
const MAPPING: AccountMapping = {
  cash: 1010,
  gcash: 1020,
  maya: 1030,
  bank: 1040,
  loans_receivable: 1110,
  interest_receivable: 1150,
  penalty_receivable: 1160,
  interest_income: 4010,
  penalty_income: 4020,
  processing_fee_income: 4030,
  credit_loss_expense: 5140,
  allowance_credit_losses: 1200,
  accounts_payable: 2010,
};

function assertBalanced(lines: { debit: number; credit: number }[]) {
  const debit = sumCentavos(lines.map((l) => l.debit));
  const credit = sumCentavos(lines.map((l) => l.credit));
  assert.equal(debit, credit, `expected balanced, got ${debit} vs ${credit}`);
}

// ── Settlement account resolution ──

test("each settlement method resolves to its own asset account", () => {
  assert.equal(settlementAccountId("cash", MAPPING), 1010);
  assert.equal(settlementAccountId("gcash", MAPPING), 1020);
  assert.equal(settlementAccountId("maya", MAPPING), 1030);
  assert.equal(settlementAccountId("bank", MAPPING), 1040);
});

// ── Loan release (spec §5, §25) ──

test("a GCash loan release debits receivable and credits GCash", () => {
  const posting = buildPosting(
    {
      event: "loan_release",
      amount: 5000000, // ₱50,000
      method: "gcash",
      reference: "LN-000154",
      branch_id: 1,
      date: "2026-09-12",
    },
    MAPPING
  );

  assert.equal(posting.source, "loan_release");
  assert.deepEqual(posting.lines, [
    { account_id: 1110, debit: 5000000, credit: 0 },
    { account_id: 1020, debit: 0, credit: 5000000 },
  ]);
  assertBalanced(posting.lines);
});

test("a cash loan release credits cash on hand instead", () => {
  const posting = buildPosting(
    { event: "loan_release", amount: 5000000, method: "cash", date: "2026-09-12", branch_id: 1 },
    MAPPING
  );
  assert.equal(posting.lines[1].account_id, 1010);
});

// ── Loan collection (spec §5) ──

test("a GCash collection splits into principal, interest and penalty", () => {
  const posting = buildPosting(
    {
      event: "loan_collection",
      method: "gcash",
      allocation: { principal: 400000, interest: 90000, penalty: 10000 },
      reference: "COL-10254",
      branch_id: 1,
      date: "2026-09-12",
    },
    MAPPING
  );

  assert.deepEqual(posting.lines, [
    { account_id: 1020, debit: 500000, credit: 0 },
    { account_id: 1110, debit: 0, credit: 400000 },
    { account_id: 4010, debit: 0, credit: 90000 },
    { account_id: 4020, debit: 0, credit: 10000 },
  ]);
  assertBalanced(posting.lines);
});

test("the debit equals the sum of the allocation, never a separate figure", () => {
  // Guards the engine from ever being handed a total that disagrees with its
  // own breakdown — the total is DERIVED, so the two cannot drift.
  const posting = buildPosting(
    {
      event: "loan_collection",
      method: "cash",
      allocation: { principal: 123456, interest: 7891, penalty: 23 },
      date: "2026-09-12",
      branch_id: 1,
    },
    MAPPING
  );
  assert.equal(posting.lines[0].debit, 123456 + 7891 + 23);
  assertBalanced(posting.lines);
});

test("a collection with no penalty produces no penalty line", () => {
  // A ₱0.00 credit to Penalty Income is noise in the ledger and makes the
  // income statement look like penalties were charged when none were.
  const posting = buildPosting(
    {
      event: "loan_collection",
      method: "bank",
      allocation: { principal: 400000, interest: 90000, penalty: 0 },
      date: "2026-09-12",
      branch_id: 1,
    },
    MAPPING
  );
  assert.equal(posting.lines.length, 3);
  assert.ok(!posting.lines.some((l) => l.account_id === 4020));
  assertBalanced(posting.lines);
});

test("a pure-principal collection is two lines", () => {
  const posting = buildPosting(
    {
      event: "loan_collection",
      method: "cash",
      allocation: { principal: 400000, interest: 0, penalty: 0 },
      date: "2026-09-12",
      branch_id: 1,
    },
    MAPPING
  );
  assert.equal(posting.lines.length, 2);
  assertBalanced(posting.lines);
});

test("fees collected with a payment credit fee income", () => {
  const posting = buildPosting(
    {
      event: "loan_collection",
      method: "gcash",
      allocation: { principal: 400000, interest: 90000, penalty: 10000, fees: 50000 },
      date: "2026-09-12",
      branch_id: 1,
    },
    MAPPING
  );
  assert.equal(posting.lines[0].debit, 550000);
  assert.ok(posting.lines.some((l) => l.account_id === 4030 && l.credit === 50000));
  assertBalanced(posting.lines);
});

test("a collection of nothing is refused", () => {
  assert.throws(
    () =>
      buildPosting(
        {
          event: "loan_collection",
          method: "cash",
          allocation: { principal: 0, interest: 0, penalty: 0 },
          date: "2026-09-12",
          branch_id: 1,
        },
        MAPPING
      ),
    /zero/i
  );
});

// ── Fund transfer (spec §7) — the "this is not income" rule ──

test("a GCash to bank transfer moves between assets and records no income", () => {
  const posting = buildPosting(
    {
      event: "fund_transfer",
      amount: 10000000,
      from: "gcash",
      to: "bank",
      date: "2026-09-12",
      branch_id: 1,
    },
    MAPPING
  );

  assert.deepEqual(posting.lines, [
    { account_id: 1040, debit: 10000000, credit: 0 },
    { account_id: 1020, debit: 0, credit: 10000000 },
  ]);
  // Nothing in the 4xxx range may appear.
  assert.ok(!posting.lines.some((l) => String(l.account_id).startsWith("4")));
  assertBalanced(posting.lines);
});

test("a transfer into the same account is refused", () => {
  assert.throws(
    () =>
      buildPosting(
        { event: "fund_transfer", amount: 100, from: "gcash", to: "gcash", date: "2026-09-12", branch_id: 1 },
        MAPPING
      ),
    /same account/i
  );
});

// ── Wallet charge (spec §5) ──

test("a GCash service charge is an expense against the wallet", () => {
  const posting = buildPosting(
    {
      event: "wallet_charge",
      amount: 5000, // ₱50
      method: "gcash",
      expense_account_id: 5080,
      date: "2026-09-12",
      branch_id: 1,
    },
    MAPPING
  );
  assert.deepEqual(posting.lines, [
    { account_id: 5080, debit: 5000, credit: 0 },
    { account_id: 1020, debit: 0, credit: 5000 },
  ]);
  assertBalanced(posting.lines);
});

// ── Expenses and payables (spec §8) ──

test("an expense paid immediately credits the paying account", () => {
  const posting = buildPosting(
    {
      event: "expense_cash",
      amount: 250000,
      expense_account_id: 5040,
      method: "gcash",
      date: "2026-09-12",
      branch_id: 1,
    },
    MAPPING
  );
  assert.deepEqual(posting.lines, [
    { account_id: 5040, debit: 250000, credit: 0 },
    { account_id: 1020, debit: 0, credit: 250000 },
  ]);
});

test("an unpaid expense credits accounts payable instead of cash", () => {
  const posting = buildPosting(
    {
      event: "expense_accrual",
      amount: 1000000,
      expense_account_id: 5030,
      date: "2026-09-12",
      branch_id: 1,
    },
    MAPPING
  );
  assert.deepEqual(posting.lines, [
    { account_id: 5030, debit: 1000000, credit: 0 },
    { account_id: 2010, debit: 0, credit: 1000000 },
  ]);
});

test("settling a payable clears the liability and moves the money", () => {
  const posting = buildPosting(
    { event: "payable_payment", amount: 1000000, method: "bank", date: "2026-09-12", branch_id: 1 },
    MAPPING
  );
  assert.deepEqual(posting.lines, [
    { account_id: 2010, debit: 1000000, credit: 0 },
    { account_id: 1040, debit: 0, credit: 1000000 },
  ]);
});

// ── Standalone loan fee (spec §5) ──

test("a separately paid processing fee is fee income", () => {
  const posting = buildPosting(
    { event: "loan_fee", amount: 50000, method: "cash", date: "2026-09-12", branch_id: 1 },
    MAPPING
  );
  assert.deepEqual(posting.lines, [
    { account_id: 1010, debit: 50000, credit: 0 },
    { account_id: 4030, debit: 0, credit: 50000 },
  ]);
});

// ── Credit loss provision (spec §9) ──

test("a provision charges expense and builds the allowance", () => {
  const posting = buildPosting(
    { event: "credit_loss_provision", amount: 5000000, date: "2026-09-30", branch_id: null },
    MAPPING
  );
  assert.deepEqual(posting.lines, [
    { account_id: 5140, debit: 5000000, credit: 0 },
    { account_id: 1200, debit: 0, credit: 5000000 },
  ]);
  assertBalanced(posting.lines);
});

// ── Invariants across every rule ──

test("a zero or negative amount is refused by every rule", () => {
  assert.throws(
    () => buildPosting({ event: "loan_release", amount: 0, method: "cash", date: "d", branch_id: 1 }, MAPPING),
    /zero/i
  );
  assert.throws(
    () => buildPosting({ event: "loan_release", amount: -100, method: "cash", date: "d", branch_id: 1 }, MAPPING),
    /zero/i
  );
});

test("a non-integer amount is refused — centavos only", () => {
  assert.throws(
    () => buildPosting({ event: "loan_release", amount: 100.5, method: "cash", date: "d", branch_id: 1 }, MAPPING),
    /whole centavos/i
  );
});

test("every posting carries its source, date, branch and reference", () => {
  const posting = buildPosting(
    {
      event: "loan_release",
      amount: 100,
      method: "cash",
      date: "2026-09-12",
      branch_id: 7,
      reference: "LN-1",
    },
    MAPPING
  );
  assert.equal(posting.date, "2026-09-12");
  assert.equal(posting.branch_id, 7);
  assert.equal(posting.reference, "LN-1");
  assert.equal(posting.source, "loan_release");
  assert.ok(posting.description.length > 0);
});

// ── Collection allocation: each component, not just the sum ──
//
// The branch validated `sumCentavos([principal, interest, penalty, fees])` and
// nothing else, so any split that added up passed however impossible its parts
// were. This file is the spec the backend will mirror, so a gap here does not
// stay in the frontend.

const collection = (allocation: {
  principal: number;
  interest: number;
  penalty: number;
  fees?: number;
}) =>
  buildPosting(
    {
      event: "loan_collection",
      date: "2026-09-15",
      method: "cash",
      allocation,
      reference: "COL-10254",
      branch_id: null,
    },
    MAPPING,
  );

test("REGRESSION: fractional components summed to a clean total and passed", () => {
  // {principal: 100.5, interest: 99.5} adds up to exactly 200 — a valid-looking
  // collection built from two amounts that cannot exist in a ledger. The entry
  // balanced, so no later check would ever have caught it.
  //
  // Stated as plain addition, which is what the old `sumCentavos` did. It now
  // rounds each value to a whole centavo, so this same pair totals 201 through
  // it — a second, independent line of defence, and the reason the historical
  // claim has to be written out rather than re-derived from today's helper.
  assert.equal(100.5 + 99.5, 200);
  assert.equal(sumCentavos([100.5, 99.5, 0, 0]), 201, "no longer a clean total");

  assert.throws(
    () => collection({ principal: 100.5, interest: 99.5, penalty: 0 }),
    /whole centavos/,
  );
});

test("REGRESSION: a negative component passed while the sum stayed positive", () => {
  // Posts a 200 debit against a 300 credit and a -100 credit. That balances
  // arithmetically and is nonsense as bookkeeping — a credit of minus money.
  assert.equal(sumCentavos([300, -100, 0, 0]), 200);
  assert.throws(
    () => collection({ principal: 300, interest: -100, penalty: 0 }),
    /cannot be negative/,
  );
});

test("each component is named in its own error", () => {
  assert.throws(
    () => collection({ principal: 100, interest: 0, penalty: 0.5 }),
    /penalty component/,
  );
  assert.throws(
    () => collection({ principal: 100, interest: 0, penalty: 0, fees: -1 }),
    /fees component/,
  );
  assert.throws(
    () => collection({ principal: -1, interest: 100, penalty: 0 }),
    /principal component/,
  );
});

test("zero components stay legal — a collection with no penalty is ordinary", () => {
  const posting = collection({ principal: 150000, interest: 25000, penalty: 0 });
  assertBalanced(posting.lines);
  // `used()` drops the empty lines rather than posting ₱0.00 rows.
  assert.ok(posting.lines.every((l) => l.debit !== 0 || l.credit !== 0));
  assert.equal(posting.lines.length, 3);
});

test("an all-zero allocation is still refused by the total check", () => {
  assert.throws(
    () => collection({ principal: 0, interest: 0, penalty: 0 }),
    /greater than zero/,
  );
});

test("a valid allocation is unchanged by the added checks", () => {
  const posting = collection({
    principal: 150000,
    interest: 25000,
    penalty: 5000,
    fees: 2000,
  });
  assertBalanced(posting.lines);
  const debit = posting.lines.find((l) => l.debit !== 0);
  assert.equal(debit?.debit, 182000, "the debit is the sum of the parts");
});

test("a non-finite component is refused rather than emitting NaN lines", () => {
  assert.throws(
    () => collection({ principal: Number.NaN, interest: 100, penalty: 0 }),
    /cannot be negative|whole centavos/,
  );
});
