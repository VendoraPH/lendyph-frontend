import { test } from "node:test";
import assert from "node:assert/strict";
import type { Account } from "@/types";
import {
  ANY_SOURCE,
  ANY_STATUS,
  accountSelectItems,
  agingBucketItems,
  agingGroupItems,
  allowanceBucketItems,
  chartTemplateItems,
  expenseStatusItems,
  journalSourceItems,
  journalStatusItems,
} from "./select-items";

// Base UI 1.8 reads a closed select's label from `items`; a value with no item
// shows raw ("any", "partially_paid", an account id).

test("journal status items label every value, including any", () => {
  assert.deepEqual(journalStatusItems, [
    { value: ANY_STATUS, label: "Any status" },
    { value: "draft", label: "Draft" },
    { value: "posted", label: "Posted" },
    { value: "reversed", label: "Reversed" },
  ]);
});

test("expense status items label every value, including any", () => {
  assert.deepEqual(expenseStatusItems, [
    { value: ANY_STATUS, label: "Any status" },
    { value: "unpaid", label: "Unpaid" },
    { value: "partially_paid", label: "Partially paid" },
    { value: "paid", label: "Paid" },
    { value: "overdue", label: "Overdue" },
  ]);
});

test("account items carry the id as the value and code and name as the label", () => {
  const accounts = [
    { id: 12, code: "1010", name: "Cash on Hand" },
    { id: 40, code: "4030", name: "Loan Processing Fee Income" },
  ] as Account[];
  assert.deepEqual(accountSelectItems(accounts), [
    { value: "12", label: "1010 Cash on Hand" },
    { value: "40", label: "4030 Loan Processing Fee Income" },
  ]);
});

test("no accounts means no account items", () => {
  assert.deepEqual(accountSelectItems([]), []);
});

test("journal source items label every source in words, after any source", () => {
  assert.deepEqual(journalSourceItems, [
    { value: ANY_SOURCE, label: "Any source" },
    { value: "loan_release", label: "Loan Release" },
    { value: "loan_collection", label: "Loan Collection" },
    { value: "penalty", label: "Penalty" },
    { value: "loan_fee", label: "Loan Fee" },
    { value: "gcash", label: "GCash" },
    { value: "cash_transaction", label: "Cash count entry" },
    { value: "bank_transaction", label: "Bank statement entry" },
    { value: "cash_in", label: "Cash In" },
    { value: "cash_out", label: "Cash Out" },
    { value: "expense", label: "Expense" },
    { value: "payable", label: "Payable" },
    { value: "transfer", label: "Transfer" },
    { value: "manual", label: "Manual" },
    { value: "adjustment", label: "Adjustment" },
    { value: "reversal", label: "Reversal" },
    { value: "opening_balance", label: "Opening Balance" },
    { value: "credit_loss", label: "Credit Loss" },
    { value: "share_capital", label: "Share Capital" },
    { value: "closing", label: "Year-end closing" },
  ]);
});

test("any source is its own value, never an empty string", () => {
  assert.notEqual(ANY_SOURCE, "");
  assert.equal(journalSourceItems.filter((item) => item.value === ANY_SOURCE).length, 1);
});

test("aging bucket items use the aging report's labels, youngest first", () => {
  assert.deepEqual(agingBucketItems, [
    { value: "current", label: "Current" },
    { value: "1_30", label: "1–30 days" },
    { value: "31_60", label: "31–60 days" },
    { value: "61_90", label: "61–90 days" },
    { value: "91_120", label: "91–120 days" },
    { value: "over_120", label: "Over 120 days" },
  ]);
});

test("aging group items offer by loan and by member", () => {
  assert.deepEqual(agingGroupItems, [
    { value: "loan", label: "By loan" },
    { value: "member", label: "By member" },
  ]);
});

test("chart template items offer the lending company chart first, then the cooperative", () => {
  assert.deepEqual(chartTemplateItems, [
    { value: "lending_company", label: "Lending company" },
    { value: "cooperative", label: "Cooperative" },
  ]);
});

test("allowance bucket items label every bucket, youngest first", () => {
  assert.deepEqual(allowanceBucketItems, [
    { value: "1_30", label: "1–30 days" },
    { value: "31_60", label: "31–60 days" },
    { value: "61_90", label: "61–90 days" },
    { value: "91_120", label: "91–120 days" },
    { value: "over_120", label: "Over 120 days" },
  ]);
});
