import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SCREENS = [
  "src/app/(app)/accounting/statements/page.tsx",
  "src/app/(app)/accounting/statements/_components/balance-sheet-report.tsx",
  "src/app/(app)/accounting/statements/_components/income-statement-report.tsx",
  "src/app/(app)/accounting/statements/_components/cash-flow-report.tsx",
  "src/app/(app)/accounting/statements/_components/equity-changes-report.tsx",
  "src/app/(app)/accounting/trial-balance/page.tsx",
  "src/app/(app)/accounting/_components/report-section.tsx",
];

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/** Field names that hold money on the statements and the trial balance. */
const MONEY = String.raw`(?:amount|total_\w+|net_\w+|\w+_cash|\w+_earnings|difference|unexplained|beginning|additions|deductions|ending|debit|credit)`;
const ADDS_MONEY = new RegExp(
  String.raw`\.${MONEY}\b\s*[-+]\s*[\w.()]*\.${MONEY}\b|\.${MONEY}\b\s*[-+]=`,
);

for (const path of SCREENS) {
  test(`${path} takes its figures from the server`, () => {
    const source = read(path);
    assert.doesNotMatch(source, /@\/lib\/accounting\/statements/);
    assert.doesNotMatch(source, /@\/lib\/accounting\/trial-balance/);
    assert.doesNotMatch(source, /signedBalance/);
    assert.doesNotMatch(source, ADDS_MONEY, "adds or subtracts two money fields");
    assert.doesNotMatch(source, /\.reduce\(/, "sums a list in the browser");
    assert.doesNotMatch(source, /Math\.abs\(/, "derives a figure in the browser");
  });
}

test("the check catches the sums the screens used to do", () => {
  assert.match("amount: sheet.total_liabilities + sheet.total_equity,", ADDS_MONEY);
  assert.match("Math.abs(tb.total_debit - tb.total_credit)", ADDS_MONEY);
  assert.doesNotMatch("amount: sheet.total_liabilities_and_equity,", ADDS_MONEY);
});

test("the balance sheet and income statement each make one server call", () => {
  const sheet = read("src/app/(app)/accounting/statements/_components/balance-sheet-report.tsx");
  assert.ok(sheet.includes("accountingService.balanceSheet("));
  assert.ok(!sheet.includes("trialBalance("));
  const income = read("src/app/(app)/accounting/statements/_components/income-statement-report.tsx");
  assert.ok(income.includes("accountingService.incomeStatement("));
  assert.ok(!income.includes("trialBalance("));
});
