import { test } from "node:test";
import assert from "node:assert/strict";
import type { ColumnBook } from "@/types";
import {
  BOOK_VIEW_ITEMS,
  balanceBadge,
  cellText,
  columnBookFooter,
  columnBookHeads,
  columnBookRowCells,
  isBookView,
  sideLabels,
  totalText,
} from "./column-book";

function receipts(overrides: Partial<ColumnBook> = {}): ColumnBook {
  return {
    kind: "cash_receipts",
    from: "2026-11-01",
    to: "2026-11-30",
    money_columns: [
      { account_id: 7, account_code: "1010", account_name: "Cash on Hand" },
      { account_id: 3, account_code: "1020", account_name: "Cash in Bank" },
    ],
    columns: [
      { key: "loans_receivable", label: "Loans Receivable" },
      { key: "interest_income", label: "Interest Income" },
      { key: "gcash_service_income", label: "GCash Service Income" },
    ],
    rows: [
      {
        journal_id: 41,
        journal_no: "JE-000041",
        date: "2026-11-03",
        reference: "OR-0001",
        particulars: "Collection LN-000004",
        money: { "7": 150050 },
        columns: { interest_income: 50050, loans_receivable: 100000 },
        sundry: [],
      },
      {
        journal_id: 42,
        journal_no: "JE-000042",
        date: "2026-11-04",
        reference: null,
        particulars: "Cash In",
        money: { "3": 10000, "7": 1500 },
        columns: { gcash_service_income: 1500 },
        sundry: [
          { account_code: "1030", account_name: "GCash Wallet", debit: 0, credit: 5000 },
          { account_code: "2010", account_name: "Accounts Payable", debit: 0, credit: 5000 },
        ],
      },
    ],
    totals: {
      money: { "7": 151550, "3": 10000 },
      columns: { loans_receivable: 100000, interest_income: 50050, gcash_service_income: 1500 },
      sundry_debit: 0,
      sundry_credit: 10000,
      total_debit: 161550,
      total_credit: 161550,
    },
    is_balanced: true,
    ...overrides,
  };
}

test("the view switch labels both views, Columns first", () => {
  assert.deepEqual(BOOK_VIEW_ITEMS, [
    { value: "columns", label: "Columns" },
    { value: "lines", label: "Lines" },
  ]);
  assert.equal(isBookView("columns"), true);
  assert.equal(isBookView("lines"), true);
  assert.equal(isBookView(""), false);
  assert.equal(isBookView(undefined), false);
});

test("receipts debit the money columns and credit the others; disbursements mirror it", () => {
  assert.deepEqual(sideLabels("cash_receipts"), { money: "Dr", columns: "Cr" });
  assert.deepEqual(sideLabels("cash_disbursements"), { money: "Cr", columns: "Dr" });
});

test("headings keep the server's order: money columns as code and name, columns by label", () => {
  assert.deepEqual(columnBookHeads(receipts()), {
    money: [
      { key: "7", label: "1010 Cash on Hand" },
      { key: "3", label: "1020 Cash in Bank" },
    ],
    columns: [
      { key: "loans_receivable", label: "Loans Receivable" },
      { key: "interest_income", label: "Interest Income" },
      { key: "gcash_service_income", label: "GCash Service Income" },
    ],
  });
});

test("a cell with no amount is empty; an amount shows in pesos with two decimals", () => {
  assert.equal(cellText(undefined), "");
  assert.equal(cellText(null), "");
  assert.equal(cellText(0), "");
  assert.equal(cellText(150050), "₱1,500.50");
  assert.equal(cellText(-2500), "-₱25.00");
});

test("a zero total shows ₱0.00 and a missing total shows a dash", () => {
  assert.equal(totalText(0), "₱0.00");
  assert.equal(totalText(undefined), "—");
  assert.equal(totalText(null), "—");
  assert.equal(totalText(161550), "₱1,615.50");
});

test("row cells follow the heading order, by account id and key, empty where the row has nothing", () => {
  const book = receipts();
  const [first, second] = book.rows.map((row) => columnBookRowCells(book, row));

  assert.equal(first.key, "41");
  assert.equal(first.journalNo, "JE-000041");
  assert.equal(first.reference, "OR-0001");
  assert.equal(first.particulars, "Collection LN-000004");
  assert.deepEqual(first.money, ["₱1,500.50", ""]);
  assert.deepEqual(first.columns, ["₱1,000.00", "₱500.50", ""]);
  assert.deepEqual(first.sundry, []);

  assert.equal(second.reference, "—");
  assert.deepEqual(second.money, ["₱15.00", "₱100.00"]);
  assert.deepEqual(second.columns, ["", "", "₱15.00"]);
});

test("each sundry line keeps its own account and side", () => {
  const book = receipts();
  const cells = columnBookRowCells(book, book.rows[1]);
  assert.deepEqual(cells.sundry, [
    { key: "0", account: "1030 GCash Wallet", debit: "", credit: "₱50.00" },
    { key: "1", account: "2010 Accounts Payable", debit: "", credit: "₱50.00" },
  ]);
});

test("keys the server sends that have no heading are not shown", () => {
  const book = receipts();
  const row = { ...book.rows[0], money: { "7": 100, "99": 5 }, columns: { stray: 5 } };
  const cells = columnBookRowCells(book, row);
  assert.deepEqual(cells.money, ["₱1.00", ""]);
  assert.deepEqual(cells.columns, ["", "", ""]);
});

test("the footer is the server's totals, in heading order, with a dash where none was sent", () => {
  assert.deepEqual(columnBookFooter(receipts()), {
    money: ["₱1,515.50", "₱100.00"],
    columns: ["₱1,000.00", "₱500.50", "₱15.00"],
    sundryDebit: "₱0.00",
    sundryCredit: "₱100.00",
  });

  const partial = receipts({
    totals: {
      money: { "7": 0 },
      columns: { interest_income: 50050 },
      sundry_debit: 0,
      sundry_credit: 0,
      total_debit: 0,
      total_credit: 0,
    },
  });
  assert.deepEqual(columnBookFooter(partial), {
    money: ["₱0.00", "—"],
    columns: ["—", "₱500.50", "—"],
    sundryDebit: "₱0.00",
    sundryCredit: "₱0.00",
  });
});

test("the badge reads the server's is_balanced", () => {
  assert.deepEqual(balanceBadge(receipts()), { label: "Balanced", balanced: true });
  assert.deepEqual(balanceBadge(receipts({ is_balanced: false })), {
    label: "Doesn't balance",
    balanced: false,
  });
});
