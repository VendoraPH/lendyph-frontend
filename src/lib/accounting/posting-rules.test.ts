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
  borrower_advances: 2300,
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
      net: 5000000, // nothing withheld: the net IS the gross
      deductions: 0,
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
    {
      event: "loan_release",
      amount: 5000000,
      net: 5000000,
      deductions: 0,
      method: "cash",
      date: "2026-09-12",
      branch_id: 1,
    },
    MAPPING
  );
  assert.equal(posting.lines[1].account_id, 1010);
});

// ── Loan release: the gross/net split ──
//
// The rule debited receivable and credited the settlement account with the SAME
// figure, which is only correct where nothing is withheld at release. This
// backend withholds twice — `LoanService::computeDeductions()` takes the
// processing, service and notarial fees and `applyInsuranceOnRelease()` takes
// the premium — so only `net_proceeds` ever leaves the drawer.

/** A release with everything named, so each test states only what it varies. */
const release = (over: {
  amount: number;
  net: number;
  deductions: number;
  method?: "cash" | "gcash" | "maya" | "bank";
}) =>
  buildPosting(
    {
      event: "loan_release",
      method: "gcash",
      date: "2026-09-12",
      branch_id: 1,
      reference: "LN-000154",
      ...over,
    },
    MAPPING,
  );

test("REGRESSION: a release with deductions credited the GROSS to cash", () => {
  // ₱50,000 principal, ₱3,000 withheld, ₱47,000 handed over. The old rule
  // credited GCash ₱50,000 and emitted no fee leg at all, so cash was
  // overstated by the deductions AND the fee income never appeared — the
  // balance sheet and the income statement wrong at once. Both legs moved by
  // the same amount, so the entry balanced and nothing downstream could catch
  // it.
  const posting = release({ amount: 5000000, net: 4700000, deductions: 300000 });

  assert.deepEqual(posting.lines, [
    { account_id: 1110, debit: 5000000, credit: 0 },
    { account_id: 1020, debit: 0, credit: 4700000 },
    { account_id: 4030, debit: 0, credit: 300000 },
  ]);
  assertBalanced(posting.lines);
});

test("the drawer is credited what left it, never what the borrower owes", () => {
  const posting = release({ amount: 5000000, net: 4700000, deductions: 300000, method: "cash" });
  const drawer = posting.lines.find((l) => l.account_id === MAPPING.cash);
  assert.equal(drawer?.credit, 4700000);
  assert.notEqual(drawer?.credit, 5000000, "the gross overstates cash by the deductions");
});

test("receivable still carries the gross — the schedule is built on it", () => {
  // The borrower owes the full principal from day one whatever they walked out
  // with, so this leg is deliberately NOT the net.
  const posting = release({ amount: 5000000, net: 4700000, deductions: 300000 });
  const receivable = posting.lines.find((l) => l.account_id === MAPPING.loans_receivable);
  assert.equal(receivable?.debit, 5000000);
});

test("the deductions are recognised as fee income at release", () => {
  const posting = release({ amount: 5000000, net: 4700000, deductions: 300000 });
  const fee = posting.lines.find((l) => l.account_id === MAPPING.processing_fee_income);
  assert.equal(fee?.credit, 300000);
});

test("a release with nothing withheld emits no empty fee leg", () => {
  // The ordinary case for a product with no fees, and the shape the rule used
  // to produce for every release.
  const posting = release({ amount: 5000000, net: 5000000, deductions: 0 });
  assert.equal(posting.lines.length, 2);
  assert.ok(!posting.lines.some((l) => l.account_id === MAPPING.processing_fee_income));
  assert.ok(posting.lines.every((l) => l.debit !== 0 || l.credit !== 0));
  assertBalanced(posting.lines);
});

test("a release whose parts do not add up to its principal is refused", () => {
  // `net_proceeds` is maintained by repeated float subtraction in pesos across
  // two backend methods, and a CSV-imported or hand-edited loan need not
  // satisfy the identity at all — so this is a real check, not ceremony.
  assert.throws(
    () => release({ amount: 5000000, net: 4000000, deductions: 500000 }),
    /does not reconcile/,
  );
});

test("the reconciliation error names all three figures", () => {
  // Saying which numbers disagree is the difference between a fixable data
  // problem and an unbalanced entry nobody can explain.
  assert.throws(
    () => release({ amount: 5000000, net: 4000000, deductions: 500000 }),
    (error: Error) =>
      error.message.includes("₱40,000.00") &&
      error.message.includes("₱5,000.00") &&
      error.message.includes("₱45,000.00") &&
      error.message.includes("₱50,000.00"),
  );
});

test("a negative net or deduction is refused and named", () => {
  assert.throws(() => release({ amount: 100, net: -1, deductions: 101 }), /net proceeds/i);
  assert.throws(() => release({ amount: 100, net: 101, deductions: -1 }), /deductions/i);
});

test("fractional proceeds are refused — centavos only", () => {
  assert.throws(
    () => release({ amount: 100, net: 99.5, deductions: 0.5 }),
    /whole centavos/,
  );
});

// ── Loan collection (spec §5) ──

test("a GCash collection splits into principal, interest and penalty", () => {
  const posting = buildPosting(
    {
      event: "loan_collection",
      method: "gcash",
      received: 500000,
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
      received: 123456 + 7891 + 23,
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
      received: 490000,
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
      received: 400000,
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
      received: 550000,
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
          received: 0,
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
    () =>
      buildPosting(
        { event: "loan_release", amount: 0, net: 0, deductions: 0, method: "cash", date: "d", branch_id: 1 },
        MAPPING
      ),
    /zero/i
  );
  assert.throws(
    () =>
      buildPosting(
        { event: "loan_release", amount: -100, net: -100, deductions: 0, method: "cash", date: "d", branch_id: 1 },
        MAPPING
      ),
    /zero/i
  );
});

test("a non-integer amount is refused — centavos only", () => {
  assert.throws(
    () =>
      buildPosting(
        { event: "loan_release", amount: 100.5, net: 100.5, deductions: 0, method: "cash", date: "d", branch_id: 1 },
        MAPPING
      ),
    /whole centavos/i
  );
});

test("every posting carries its source, date, branch and reference", () => {
  const posting = buildPosting(
    {
      event: "loan_release",
      amount: 100,
      net: 100,
      deductions: 0,
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

/**
 * `received` defaults to what the parts add up to, which is the reconciling
 * case; pass it explicitly to express a payment whose figures disagree.
 */
const collection = (
  allocation: {
    principal: number;
    interest: number;
    penalty: number;
    fees?: number;
    overpayment?: number;
  },
  received = allocation.principal +
    allocation.interest +
    allocation.penalty +
    (allocation.fees ?? 0) +
    (allocation.overpayment ?? 0),
) =>
  buildPosting(
    {
      event: "loan_collection",
      date: "2026-09-15",
      method: "cash",
      received,
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

// ── Collection: what arrived, not what it settled ──
//
// `repayments.amount_paid` is not bounded by what is owed — the store request
// validates only `numeric, min:0.01` — and the excess is persisted as
// `repayments.overpayment`. The rule debited `principal + interest + penalty +
// fees` and ignored the excess, so the ledger's cash balance drifted below the
// cash actually in the drawer by exactly that amount.

test("REGRESSION: an overpayment never reached the drawer", () => {
  // ₱6,000 handed over against ₱5,000 due. The old rule debited GCash ₱5,000
  // and emitted four lines; the ₱1,000 the borrower actually paid went
  // nowhere.
  const posting = buildPosting(
    {
      event: "loan_collection",
      method: "gcash",
      received: 600000,
      allocation: { principal: 400000, interest: 90000, penalty: 10000, overpayment: 100000 },
      reference: "COL-10254",
      date: "2026-09-15",
      branch_id: 1,
    },
    MAPPING,
  );

  assert.deepEqual(posting.lines, [
    { account_id: 1020, debit: 600000, credit: 0 },
    { account_id: 1110, debit: 0, credit: 400000 },
    { account_id: 4010, debit: 0, credit: 90000 },
    { account_id: 4020, debit: 0, credit: 10000 },
    { account_id: 2300, debit: 0, credit: 100000 },
  ]);
  assertBalanced(posting.lines);
});

test("an overpayment is a liability and never income", () => {
  // Money the organisation is HOLDING, not money it has earned: credited to an
  // income account it would report revenue the borrower can still ask back.
  const posting = collection({
    principal: 400000,
    interest: 90000,
    penalty: 0,
    overpayment: 100000,
  });
  const held = posting.lines.find((l) => l.credit === 100000);
  assert.equal(held?.account_id, MAPPING.borrower_advances);
  assert.ok(
    !posting.lines.some((l) => String(l.account_id).startsWith("4") && l.credit === 100000),
    "nothing in the 4xxx range may carry an overpayment",
  );
});

test("a payment that settles nothing at all still posts", () => {
  // Paying ahead of the schedule, with no instalment due. The old rule refused
  // this outright — the allocation was empty, so its derived total was zero.
  const posting = collection(
    { principal: 0, interest: 0, penalty: 0, overpayment: 100000 },
  );
  assert.deepEqual(posting.lines, [
    { account_id: 1010, debit: 100000, credit: 0 },
    { account_id: 2300, debit: 0, credit: 100000 },
  ]);
  assertBalanced(posting.lines);
});

test("a payment whose parts do not add up to what arrived is refused", () => {
  // ₱6,000 received, ₱5,000 accounted for and nothing recorded as unallocated.
  // The old rule quietly posted the ₱5,000 and lost the difference.
  assert.throws(
    () => collection({ principal: 500000, interest: 0, penalty: 0 }, 600000),
    /does not reconcile/,
  );
});

test("the payment reconciliation error names what arrived and what was allocated", () => {
  assert.throws(
    () => collection({ principal: 500000, interest: 0, penalty: 0 }, 600000),
    (error: Error) =>
      error.message.includes("₱5,000.00") && error.message.includes("₱6,000.00"),
  );
});

test("a negative overpayment is refused and named", () => {
  // Direction belongs to the column, not the sign — and a negative excess
  // would silently reduce the debit to the drawer.
  assert.throws(
    () => collection({ principal: 100000, interest: 0, penalty: 0, overpayment: -1 }, 99999),
    /overpayment cannot be negative/i,
  );
});

test("a fractional overpayment is refused — centavos only", () => {
  assert.throws(
    () => collection({ principal: 100000, interest: 0, penalty: 0, overpayment: 0.5 }),
    /whole centavos/,
  );
});

test("a collection with no overpayment emits no advances line", () => {
  const posting = collection({ principal: 400000, interest: 90000, penalty: 0 });
  assert.ok(!posting.lines.some((l) => l.account_id === MAPPING.borrower_advances));
  assert.equal(posting.lines[0].debit, 490000);
  assertBalanced(posting.lines);
});
