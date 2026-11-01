import { test } from "node:test";
import assert from "node:assert/strict";
import type { Account } from "@/types";
import {
  ANY_STATUS,
  accountSelectItems,
  expenseStatusItems,
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
