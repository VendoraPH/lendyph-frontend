import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  buildIncomeStatement,
  buildBalanceSheet,
  dayBefore,
  startOfFinancialYear,
  subtractTrialBalances,
} from "./statements";
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

test("subtractTrialBalances yields the movement between two dates", () => {
  const opening = [row("4010", "Interest Income", "income", 0, 10_000_00)];
  const closing = [row("4010", "Interest Income", "income", 0, 26_000_00)];

  const [movement] = subtractTrialBalances(closing, opening);

  // Cumulative income went from ₱10,000 to ₱26,000, so the period earned
  // ₱16,000 — not the ₱26,000 the closing trial balance states on its own.
  assert.equal(movement.credit, 16_000_00);
  assert.equal(movement.debit, 0);
  assert.equal(
    buildIncomeStatement(subtractTrialBalances(closing, opening), {
      from: "2026-09-01",
      to: "2026-09-30",
    }).total_income,
    16_000_00
  );
});

test("subtractTrialBalances keeps accounts that closed out to zero", () => {
  const opening = [row("1010", "Cash on Hand", "asset", 5_000_00, 0)];

  const [movement] = subtractTrialBalances([], opening);

  // The account is gone from the closing set, which means it moved by its
  // whole opening balance. Dropping the row would lose ₱5,000 of movement.
  assert.equal(movement.account_code, "1010");
  assert.equal(movement.credit, 5_000_00);
  assert.equal(movement.debit, 0);
});

// ── The two tabs agreeing about the same year ──
//
// The defect these pin: a trial balance is CUMULATIVE, so the closing one alone
// carries every peso earned since the books opened. `buildBalanceSheet` derived
// net income from it and printed the result as "Current Year Earnings", while
// the Income Statement one tab away differenced two balances and got the year.
// Both screens showed green. The balanced badge could never have caught it —
// `difference` is identically zero whenever the input trial balance balances,
// however the earnings are split out of it.

/**
 * A co-op trading since 2024 whose books have never been closed. This is the
 * DEFAULT state for every organisation on this module, not an edge case:
 * nothing has closed them, because the module is new.
 *
 * Lifetime surplus ₱3,000,000, of which ₱750,000 was earned this year.
 */
const OPENING_2026: TrialBalanceRow[] = [
  row("1010", "Cash on Hand", "asset", 500000000, 0),
  row("3010", "Capital", "equity", 0, 275000000),
  row("4010", "Interest Income", "income", 0, 300000000),
  row("5010", "Salaries and Wages", "expense", 75000000, 0),
];

const CLOSING_2026: TrialBalanceRow[] = [
  row("1010", "Cash on Hand", "asset", 575000000, 0),
  row("3010", "Capital", "equity", 0, 275000000),
  row("4010", "Interest Income", "income", 0, 390000000),
  row("5010", "Salaries and Wages", "expense", 90000000, 0),
];

const YEAR_2026 = { from: "2026-01-01", to: "2026-09-15" };

test("the unclosed-books fixture balances on both dates", () => {
  for (const [label, rows] of [
    ["opening", OPENING_2026],
    ["closing", CLOSING_2026],
  ] as const) {
    const debits = rows.reduce((sum, r) => sum + r.debit, 0);
    const credits = rows.reduce((sum, r) => sum + r.credit, 0);
    assert.equal(debits, credits, `${label} trial balance must close`);
  }
});

test("REGRESSION: the sheet used to claim ₱3,000,000 where the P&L said ₱750,000", () => {
  const incomeStatement = buildIncomeStatement(
    subtractTrialBalances(CLOSING_2026, OPENING_2026),
    YEAR_2026,
  );
  // The old call: closing rows only, no opening balance.
  const oldSheet = buildBalanceSheet(CLOSING_2026, YEAR_2026.to);

  assert.equal(incomeStatement.net_income, 75000000, "₱750,000 — the year");
  assert.equal(oldSheet.current_year_earnings, 300000000, "₱3,000,000 — since 2024");
  assert.ok(
    oldSheet.is_balanced && oldSheet.difference === 0,
    "and the badge said green, because difference cannot detect this",
  );
});

test("given the opening balance, both statements report the same year", () => {
  const incomeStatement = buildIncomeStatement(
    subtractTrialBalances(CLOSING_2026, OPENING_2026),
    YEAR_2026,
  );
  const sheet = buildBalanceSheet(CLOSING_2026, YEAR_2026.to, {
    rows: OPENING_2026,
    period: YEAR_2026,
  });

  assert.equal(
    sheet.current_year_earnings,
    incomeStatement.net_income,
    "the two tabs must not be able to disagree",
  );
  assert.equal(sheet.current_year_earnings, 75000000);
});

test("earlier earnings are shown, not discarded, so the sheet still closes", () => {
  const sheet = buildBalanceSheet(CLOSING_2026, YEAR_2026.to, {
    rows: OPENING_2026,
    period: YEAR_2026,
  });

  assert.equal(sheet.prior_period_earnings, 225000000, "₱2,250,000 from 2024–25");
  // The split must be exhaustive: prior + current is the cumulative figure, or
  // equity is short by the difference and the sheet stops balancing.
  assert.equal(
    sheet.prior_period_earnings + sheet.current_year_earnings,
    300000000,
  );
  assert.equal(sheet.difference, 0);
  assert.ok(sheet.is_balanced);
});

test("the two earnings lines are separately visible and separately named", () => {
  const sheet = buildBalanceSheet(CLOSING_2026, YEAR_2026.to, {
    rows: OPENING_2026,
    period: YEAR_2026,
  });

  const current = sheet.equity.find((l) => l.account_code === "3040");
  const prior = sheet.equity.find((l) => l.account_code === "3045");

  assert.equal(current?.account_name, "Current Year Earnings");
  assert.equal(current?.amount, 75000000);
  assert.equal(prior?.account_name, "Prior Period Earnings (not yet closed)");
  assert.equal(prior?.amount, 225000000);
});

test("the derived lines cannot collide with a posted Retained Earnings account", () => {
  // 3030 is a real, postable account in the seeded chart. Reusing its code for
  // the derived line would put two identically named rows in one section with
  // the same React key, and nothing on screen to tell them apart.
  const withPosted = [
    ...CLOSING_2026,
    row("3030", "Retained Earnings", "equity", 0, 0),
  ];
  const sheet = buildBalanceSheet(withPosted, YEAR_2026.to, {
    rows: OPENING_2026,
    period: YEAR_2026,
  });

  const codes = sheet.equity.map((l) => l.account_code);
  assert.equal(new Set(codes).size, codes.length, "no duplicate keys in equity");
  assert.ok(!codes.includes("3030") || codes.filter((c) => c === "3030").length === 1);
});

test("without an opening balance the line stops claiming a year it does not cover", () => {
  const sheet = buildBalanceSheet(CLOSING_2026, YEAR_2026.to);

  assert.equal(sheet.earnings_basis, "cumulative");
  assert.equal(sheet.earnings_period, null);
  const line = sheet.equity.find((l) => l.account_code === "3040");
  assert.equal(line?.account_name, "Accumulated Earnings (not yet closed)");
  assert.equal(sheet.prior_period_earnings, 0, "folded into the one line instead");
});

test("the basis flag says which window the figure covers", () => {
  const withOpening = buildBalanceSheet(CLOSING_2026, YEAR_2026.to, {
    rows: OPENING_2026,
    period: YEAR_2026,
  });
  assert.equal(withOpening.earnings_basis, "period");
  assert.deepEqual(withOpening.earnings_period, YEAR_2026);
});

test("a first year of trading has no prior earnings and one line", () => {
  // Opening rows exist but carry no income or expense — the books really did
  // start here, so a "Prior Period Earnings ₱0.00" row would be noise.
  const firstYearOpening = [row("3010", "Capital", "equity", 0, 275000000)];
  const sheet = buildBalanceSheet(CLOSING_2026, YEAR_2026.to, {
    rows: firstYearOpening,
    period: YEAR_2026,
  });

  assert.equal(sheet.prior_period_earnings, 0);
  assert.ok(!sheet.equity.some((l) => l.account_code === "3045"));
  assert.equal(sheet.current_year_earnings, 300000000);
});

// ── Shared date helpers ──

test("dayBefore steps back one calendar day, including across a year end", () => {
  assert.equal(dayBefore("2026-01-01"), "2025-12-31");
  assert.equal(dayBefore("2026-09-15"), "2026-09-14");
  assert.equal(dayBefore("2026-03-01"), "2026-02-28");
});

test("dayBefore gives the same answer in Manila as anywhere else", () => {
  // The hazard this guards: `toISOString()` is UTC, so slicing a date out of it
  // reports YESTERDAY before 08:00 in Manila (UTC+8) — an opening trial balance
  // taken a day early moves income between periods silently. `formatDateISO`
  // reads local calendar fields instead, which is why this holds everywhere.
  //
  // Run in child processes because TZ is fixed when a process starts; asserting
  // it in-process would only ever test whichever machine ran the suite, and
  // this one happens to sit at UTC+08:00, where the bug is live.
  const probe = [
    'import { dayBefore } from "./src/lib/accounting/statements";',
    'process.stdout.write(dayBefore("2026-01-01") + "," + dayBefore("2026-09-15"));',
  ].join("\n");

  const results = ["Asia/Manila", "America/New_York", "UTC"].map((tz) =>
    execFileSync(process.execPath, ["--import", "tsx", "--eval", probe], {
      cwd: process.cwd(),
      env: { ...process.env, TZ: tz },
      encoding: "utf8",
    }),
  );

  for (const [i, out] of results.entries()) {
    assert.equal(out, "2025-12-31,2026-09-14", `wrong calendar day in zone #${i}`);
  }
  assert.equal(new Set(results).size, 1, "the answer must not depend on the host");
});

test("the financial year starts on 1 January of the as-of date's year", () => {
  assert.equal(startOfFinancialYear("2026-09-15"), "2026-01-01");
  assert.equal(startOfFinancialYear("2026-01-01"), "2026-01-01");
  assert.equal(startOfFinancialYear("2024-12-31"), "2024-01-01");
});

test("the balance sheet asks for the year's opening balance, not the filter's", () => {
  // Mirrors `BalanceSheetReport`'s fetcher exactly. The balance sheet tab hides
  // the shared "From" filter because a balance sheet is a position on a date,
  // so its earnings period has to come from `asOf` — "current year" on a
  // balance sheet means the financial year, whatever range someone last set
  // for the P&L. Pinned here because that convention is the only reason the
  // two tabs agree by default and stay defensible when they do not.
  const asOf = "2026-09-15";
  const from = startOfFinancialYear(asOf);

  assert.equal(from, "2026-01-01");
  assert.equal(dayBefore(from), "2025-12-31", "the opening trial balance's date");

  // And the Income Statement tab's own default period is that same year, which
  // is what makes the default view of the two tabs agree exactly.
  assert.equal(from, `${new Date(`${asOf}T00:00:00`).getFullYear()}-01-01`);
});
