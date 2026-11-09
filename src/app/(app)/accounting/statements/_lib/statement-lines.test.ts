import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  BalanceSheetLine,
  EquityChangeRow,
  IncomeStatementLine,
  ReportLine,
} from "@/types";
import {
  balanceSheetLineLabel,
  balanceSheetLines,
  cashFlowLines,
  equityRowKey,
  incomeStatementLines,
} from "./statement-lines";

const account = (over: Partial<BalanceSheetLine> = {}): BalanceSheetLine => ({
  account_id: 7,
  account_code: "1010",
  account_name: "Cash on Hand",
  amount: 150000,
  kind: "account",
  ...over,
});

test("an account line reads its own account name", () => {
  assert.equal(balanceSheetLineLabel(account()), "Cash on Hand");
});

test("the two derived earnings lines read their fixed labels, whatever the server named them", () => {
  assert.equal(
    balanceSheetLineLabel(
      account({ kind: "current_year_earnings", account_id: null, account_code: null, account_name: "x" }),
    ),
    "Current Year Earnings",
  );
  assert.equal(
    balanceSheetLineLabel(
      account({ kind: "prior_period_earnings", account_id: null, account_code: null, account_name: "x" }),
    ),
    "Prior Period Earnings (not yet closed)",
  );
});

test("balance sheet lines keep the server's amount and give derived lines a key and no code", () => {
  const lines = balanceSheetLines([
    account(),
    account({ kind: "prior_period_earnings", account_id: null, account_code: null, amount: -2500 }),
    account({ kind: "current_year_earnings", account_id: null, account_code: null, amount: 0 }),
  ]);
  assert.deepEqual(lines, [
    { key: "account-7", code: "1010", label: "Cash on Hand", amount: 150000 },
    { key: "prior_period_earnings", code: undefined, label: "Prior Period Earnings (not yet closed)", amount: -2500 },
    { key: "current_year_earnings", code: undefined, label: "Current Year Earnings", amount: 0 },
  ]);
});

test("income statement lines are shown as the server sends them, zero included", () => {
  const rows: IncomeStatementLine[] = [
    { account_id: 3, account_code: "4010", account_name: "Interest Income", amount: 0 },
    { account_id: 4, account_code: "4030", account_name: "Loan Processing Fee Income", amount: 1250 },
  ];
  assert.deepEqual(incomeStatementLines(rows), [
    { key: "account-3", code: "4010", label: "Interest Income", amount: 0 },
    { key: "account-4", code: "4030", label: "Loan Processing Fee Income", amount: 1250 },
  ]);
});

test("cash flow lines read the server's label, and a derived line has no code", () => {
  const rows: ReportLine[] = [
    { account_id: 9, account_code: "1110", label: "Current Loans Receivable", amount: 50000, kind: "account" },
    {
      account_id: null,
      account_code: null,
      label: "Loans released, net of amounts withheld",
      amount: -980000,
      kind: "loan_releases",
    },
    {
      account_id: null,
      account_code: null,
      label: "Deductions collected on restructures",
      amount: 12000,
      kind: "restructure_collections",
    },
  ];
  assert.deepEqual(cashFlowLines(rows, "operating"), [
    { key: "operating-account-9", code: "1110", label: "Current Loans Receivable", amount: 50000 },
    {
      key: "operating-loan_releases-1",
      code: undefined,
      label: "Loans released, net of amounts withheld",
      amount: -980000,
    },
    {
      key: "operating-restructure_collections-2",
      code: undefined,
      label: "Deductions collected on restructures",
      amount: 12000,
    },
  ]);
});

test("cash flow keys stay unique when two lines share an account across sections", () => {
  const row: ReportLine = { account_id: 9, account_code: "1110", label: "A", amount: 1, kind: "account" };
  const keys = [...cashFlowLines([row], "operating"), ...cashFlowLines([row], "non_cash")].map((l) => l.key);
  assert.equal(new Set(keys).size, 2);
});

test("the earnings row of the equity changes has its own key, apart from the account rows", () => {
  const base: EquityChangeRow = {
    label: "Capital",
    account_id: 11,
    account_code: "3010",
    kind: "account",
    beginning: 0,
    additions: 0,
    deductions: 0,
    ending: 0,
  };
  const earnings: EquityChangeRow = {
    ...base,
    label: "Earnings not yet closed",
    account_id: null,
    account_code: null,
    kind: "earnings",
  };
  assert.equal(equityRowKey(base), "account-11");
  assert.equal(equityRowKey(earnings), "earnings");
});
