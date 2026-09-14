import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIncomeStatement, buildBalanceSheet } from "./statements";
import type { TrialBalanceRow } from "@/types/accounting";

function row(
  code: string,
  name: string,
  type: TrialBalanceRow["type"],
  debit: number,
  credit: number
): TrialBalanceRow {
  return {
    account_id: Number(code),
    account_code: code,
    account_name: name,
    type,
    debit,
    credit,
  };
}

/** The worked example from the spec, in centavos. */
const ROWS: TrialBalanceRow[] = [
  row("1010", "Cash on Hand", "asset", 52000000, 0),
  row("1040", "Bank Accounts", "asset", 125000000, 0),
  row("1110", "Loans Receivable", "asset", 485000000, 0),
  row("1200", "Allowance for Credit Losses", "asset", 0, 15000000),
  row("2010", "Accounts Payable", "liability", 0, 30000000),
  // ₱5,520,000 — chosen so the fixture's own trial balance closes
  // (debits 687,000,000 = credits 687,000,000). A fixture that does not
  // balance cannot prove anything about a statement that must.
  row("3010", "Capital", "equity", 0, 552000000),
  row("4010", "Interest Income", "income", 0, 85000000),
  row("4020", "Penalty Income", "income", 0, 5000000),
  row("5010", "Salaries and Wages", "expense", 20000000, 0),
  row("5020", "Rent", "expense", 5000000, 0),
];

test("the fixture's own books balance", () => {
  // Guards every expectation below: if debits and credits here ever drift
  // apart, the balance-sheet assertions are testing arithmetic that could not
  // happen in real books, and a failure would point at the code rather than at
  // this list.
  const debits = ROWS.reduce((sum, r) => sum + r.debit, 0);
  const credits = ROWS.reduce((sum, r) => sum + r.credit, 0);
  assert.equal(debits, credits);
});

// ── Income statement ──

test("totals income and expenses and nets them", () => {
  const is = buildIncomeStatement(ROWS, { from: "2026-09-01", to: "2026-09-30" });
  assert.equal(is.total_income, 90000000);
  assert.equal(is.total_expenses, 25000000);
  assert.equal(is.net_income, 65000000);
});

test("only income and expense accounts reach the income statement", () => {
  const is = buildIncomeStatement(ROWS, { from: "a", to: "b" });
  const codes = [...is.income, ...is.expenses].map((l) => l.account_code);
  assert.deepEqual(codes, ["4010", "4020", "5010", "5020"]);
});

test("a loss comes out negative rather than flipped", () => {
  const is = buildIncomeStatement(
    [
      row("4010", "Interest Income", "income", 0, 1000),
      row("5010", "Salaries", "expense", 5000, 0),
    ],
    { from: "a", to: "b" }
  );
  assert.equal(is.net_income, -4000);
});

test("income lines are netted in their normal direction", () => {
  // A refund debited against interest income reduces it.
  const is = buildIncomeStatement(
    [row("4010", "Interest Income", "income", 2000, 10000)],
    { from: "a", to: "b" }
  );
  assert.equal(is.total_income, 8000);
});

test("statement lines carry the period they cover", () => {
  const is = buildIncomeStatement(ROWS, { from: "2026-09-01", to: "2026-09-30" });
  assert.equal(is.period.from, "2026-09-01");
  assert.equal(is.period.to, "2026-09-30");
});

test("an empty book nets to zero", () => {
  const is = buildIncomeStatement([], { from: "a", to: "b" });
  assert.equal(is.net_income, 0);
  assert.equal(is.income.length, 0);
});

// ── Balance sheet ──

test("assets equal liabilities plus equity once earnings are carried in", () => {
  // THE test. Capital alone is ₱5,570,000 and assets are ₱6,470,000; the
  // sheet only closes because the ₱650,000 of net income is carried into
  // equity as current-year earnings. Omitting that is the classic error that
  // leaves a balance sheet permanently out by exactly the year's profit.
  const bs = buildBalanceSheet(ROWS, "2026-09-30");

  assert.equal(bs.total_assets, 647000000);
  assert.equal(bs.total_liabilities, 30000000);
  assert.equal(bs.current_year_earnings, 65000000);
  assert.equal(bs.total_equity, 617000000);
  assert.equal(bs.total_liabilities + bs.total_equity, bs.total_assets);
  assert.equal(bs.is_balanced, true);
});

test("a contra asset subtracts from assets instead of adding", () => {
  // Allowance for Credit Losses is credit-balanced. Counting it as a positive
  // asset would overstate the portfolio by twice the allowance.
  const bs = buildBalanceSheet(ROWS, "2026-09-30");
  const allowance = bs.assets.find((l) => l.account_code === "1200")!;
  assert.equal(allowance.amount, -15000000);
  // 520,000 + 1,250,000 + 4,850,000 - 150,000 = 6,470,000
  assert.equal(bs.total_assets, 647000000);
});

test("a loss reduces equity", () => {
  const bs = buildBalanceSheet(
    [
      row("1010", "Cash", "asset", 6000, 0),
      row("3010", "Capital", "equity", 0, 10000),
      row("5010", "Salaries", "expense", 4000, 0),
    ],
    "2026-09-30"
  );
  assert.equal(bs.current_year_earnings, -4000);
  assert.equal(bs.total_equity, 6000);
  assert.equal(bs.is_balanced, true);
});

test("income and expense accounts do not appear as balance sheet lines", () => {
  const bs = buildBalanceSheet(ROWS, "2026-09-30");
  const codes = [...bs.assets, ...bs.liabilities, ...bs.equity].map(
    (l) => l.account_code
  );
  assert.ok(!codes.includes("4010"));
  assert.ok(!codes.includes("5010"));
});

test("current year earnings appear as an equity line, not just a total", () => {
  const bs = buildBalanceSheet(ROWS, "2026-09-30");
  const earnings = bs.equity.find((l) => l.account_code === "3040");
  assert.ok(earnings, "expected a current-year-earnings line");
  assert.equal(earnings!.amount, 65000000);
});

test("books that do not balance are reported, not silently corrected", () => {
  const bs = buildBalanceSheet(
    [
      row("1010", "Cash", "asset", 10000, 0),
      row("3010", "Capital", "equity", 0, 9000),
    ],
    "2026-09-30"
  );
  assert.equal(bs.is_balanced, false);
  assert.equal(bs.difference, 1000);
});

test("an empty book balances at zero", () => {
  const bs = buildBalanceSheet([], "2026-09-30");
  assert.equal(bs.total_assets, 0);
  assert.equal(bs.is_balanced, true);
});
