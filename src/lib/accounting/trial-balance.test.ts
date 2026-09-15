import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTrialBalance, runningBalances } from "./trial-balance";
import type { Account, AccountType } from "@/types/accounting";

function account(
  id: number,
  code: string,
  name: string,
  type: AccountType,
  over: Partial<Account> = {}
): Account {
  return {
    id,
    code,
    name,
    type,
    normal_balance: type === "asset" || type === "expense" ? "debit" : "credit",
    is_contra: false,
    parent_id: null,
    is_group: false,
    is_active: true,
    ...over,
  };
}

const CASH = account(1, "1010", "Cash on Hand", "asset");
const LOANS = account(2, "1110", "Loans Receivable", "asset");
const PAYABLE = account(3, "2010", "Accounts Payable", "liability");
const CAPITAL = account(4, "3010", "Capital", "equity");
const INTEREST = account(5, "4010", "Interest Income", "income");
const RENT = account(6, "5020", "Rent", "expense");

test("a balanced set of books reports balanced", () => {
  const tb = buildTrialBalance(
    [
      { account: CASH, debit: 100000000, credit: 0 },
      { account: LOANS, debit: 500000000, credit: 0 },
      { account: PAYABLE, debit: 0, credit: 50000000 },
      { account: CAPITAL, debit: 0, credit: 500000000 },
      { account: INTEREST, debit: 0, credit: 80000000 },
      { account: RENT, debit: 30000000, credit: 0 },
    ],
    "2026-09-30"
  );

  assert.equal(tb.total_debit, 630000000);
  assert.equal(tb.total_credit, 630000000);
  assert.equal(tb.difference, 0);
  assert.equal(tb.is_balanced, true);
  assert.equal(tb.as_of, "2026-09-30");
});

test("each account is netted before it is placed", () => {
  // Cash debited 500 and credited 200 shows as one 300 debit, not both.
  const tb = buildTrialBalance(
    [
      { account: CASH, debit: 50000, credit: 20000 },
      { account: CAPITAL, debit: 0, credit: 30000 },
    ],
    "2026-09-30"
  );
  const cash = tb.rows.find((r) => r.account_id === 1)!;
  assert.equal(cash.debit, 30000);
  assert.equal(cash.credit, 0);
});

test("an account that swings against its normal side lands in the other column", () => {
  // An overdrawn cash account is credit-balanced. Hiding that as a negative
  // debit would make the column totals lie.
  const tb = buildTrialBalance(
    [
      { account: CASH, debit: 10000, credit: 40000 },
      { account: CAPITAL, debit: 30000, credit: 0 },
    ],
    "2026-09-30"
  );
  const cash = tb.rows.find((r) => r.account_id === 1)!;
  assert.equal(cash.debit, 0);
  assert.equal(cash.credit, 30000);
  assert.equal(tb.is_balanced, true);
});

test("an unbalanced set reports the exact difference", () => {
  const tb = buildTrialBalance(
    [
      { account: CASH, debit: 100000, credit: 0 },
      { account: CAPITAL, debit: 0, credit: 95000 },
    ],
    "2026-09-30"
  );
  assert.equal(tb.difference, 5000);
  assert.equal(tb.is_balanced, false);
});

test("accounts with no movement are left off", () => {
  // A trial balance listing every zero account buries the real rows.
  const tb = buildTrialBalance(
    [
      { account: CASH, debit: 100000, credit: 0 },
      { account: LOANS, debit: 0, credit: 0 },
      { account: CAPITAL, debit: 0, credit: 100000 },
    ],
    "2026-09-30"
  );
  assert.equal(tb.rows.length, 2);
  assert.ok(!tb.rows.some((r) => r.account_id === 2));
});

test("an account whose debits and credits cancel exactly is left off", () => {
  const tb = buildTrialBalance(
    [
      { account: CASH, debit: 50000, credit: 50000 },
      { account: LOANS, debit: 100000, credit: 0 },
      { account: CAPITAL, debit: 0, credit: 100000 },
    ],
    "2026-09-30"
  );
  assert.ok(!tb.rows.some((r) => r.account_id === 1));
});

test("group headers are excluded so their children are not counted twice", () => {
  const header = account(9, "1000", "Assets", "asset", { is_group: true });
  const tb = buildTrialBalance(
    [
      { account: header, debit: 100000, credit: 0 },
      { account: CASH, debit: 100000, credit: 0 },
      { account: CAPITAL, debit: 0, credit: 100000 },
    ],
    "2026-09-30"
  );
  assert.equal(tb.rows.length, 2);
  assert.equal(tb.total_debit, 100000);
  assert.equal(tb.is_balanced, true);
});

test("rows come out in account-code order", () => {
  const tb = buildTrialBalance(
    [
      { account: RENT, debit: 1000, credit: 0 },
      { account: CASH, debit: 1000, credit: 0 },
      { account: INTEREST, debit: 0, credit: 2000 },
    ],
    "2026-09-30"
  );
  assert.deepEqual(
    tb.rows.map((r) => r.account_code),
    ["1010", "4010", "5020"]
  );
});

test("an empty book is balanced at zero, not broken", () => {
  const tb = buildTrialBalance([], "2026-09-30");
  assert.equal(tb.rows.length, 0);
  assert.equal(tb.is_balanced, true);
  assert.equal(tb.total_debit, 0);
});

// ── Running balance for the general ledger ──

test("running balance accumulates in the account's normal direction", () => {
  const rows = runningBalances(
    CASH,
    [
      { debit: 100000, credit: 0 },
      { debit: 0, credit: 30000 },
      { debit: 50000, credit: 0 },
    ],
    0
  );
  assert.deepEqual(rows, [100000, 70000, 120000]);
});

test("running balance on a credit-normal account grows with credits", () => {
  const rows = runningBalances(
    PAYABLE,
    [
      { debit: 0, credit: 100000 },
      { debit: 40000, credit: 0 },
    ],
    0
  );
  assert.deepEqual(rows, [100000, 60000]);
});

test("running balance starts from the opening balance", () => {
  const rows = runningBalances(CASH, [{ debit: 5000, credit: 0 }], 20000);
  assert.deepEqual(rows, [25000]);
});

test("an empty ledger produces no rows", () => {
  assert.deepEqual(runningBalances(CASH, [], 1000), []);
});
