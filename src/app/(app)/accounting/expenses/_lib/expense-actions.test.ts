import { test } from "node:test";
import assert from "node:assert/strict";
import type { Expense, ExpensePayment, Permission } from "@/types";
import {
  REVERSAL_REASON_MAX,
  canEditExpense,
  canReversePayment,
  expenseMenu,
  hasPayments,
  moreActionsLabel,
  paymentStatusLabel,
  reversalReason,
  reversalText,
  reverseExpenseState,
} from "./expense-actions";

const PAYMENT: ExpensePayment = {
  id: 9,
  date: "2026-10-05",
  amount: 400_000,
  payment_account_id: 3,
  payment_account_name: "Cash on Hand",
  journal_id: 21,
  journal_no: "JE-000021",
  reversed: false,
  can_reverse: true,
};

const EXPENSE: Expense = {
  id: 4,
  date: "2026-10-01",
  payee: "Meralco",
  expense_account_id: 7,
  amount: 1_000_000,
  amount_paid: 400_000,
  payment_account_id: null,
  branch_id: 1,
  status: "partially_paid",
  amount_due: 600_000,
  can_edit: true,
  can_reverse: false,
  reverse_blocked_reason: "Reverse its payments first: ₱4,000.00 paid in 1 payment.",
  payments: [PAYMENT],
};

const holding =
  (...held: Permission[]) =>
  (permission: Permission) =>
    held.includes(permission);

test("Edit needs expenses:update and is hidden once the expense is reversed", () => {
  const can = holding("expenses:update");
  assert.equal(canEditExpense(EXPENSE, can), true);
  assert.equal(canEditExpense({ ...EXPENSE, can_edit: false, status: "reversed" }, can), false);
  assert.equal(canEditExpense(EXPENSE, holding()), false);
  // A server that sends no flag: the status decides.
  assert.equal(canEditExpense({ status: "reversed" }, can), false);
  assert.equal(canEditExpense({ status: "unpaid" }, can), true);
});

test("Reverse expense waits with the server's reason while payments stand", () => {
  const can = holding("expenses:update", "journals:reverse");
  assert.deepEqual(reverseExpenseState(EXPENSE, can), {
    shown: true,
    disabledReason: "Reverse its payments first: ₱4,000.00 paid in 1 payment.",
  });
  assert.deepEqual(reverseExpenseState({ can_reverse: true, reverse_blocked_reason: null }, can), {
    shown: true,
    disabledReason: null,
  });
});

test("Reverse expense is hidden when it doesn't apply or the user can't take it", () => {
  const can = holding("expenses:update", "journals:reverse");
  // Already reversed: neither open nor waiting.
  assert.deepEqual(reverseExpenseState({ can_reverse: false, reverse_blocked_reason: null }, can), {
    shown: false,
    disabledReason: null,
  });
  assert.equal(reverseExpenseState({ can_reverse: false, reverse_blocked_reason: "  " }, can).shown, false);
  for (const held of [holding("expenses:update"), holding("journals:reverse"), holding("expenses:pay", "journals:reverse")]) {
    assert.equal(reverseExpenseState({ can_reverse: true, reverse_blocked_reason: null }, held).shown, false);
  }
});

test("Reverse payment needs expenses:pay and journals:reverse, while the server offers it", () => {
  assert.equal(canReversePayment(PAYMENT, holding("expenses:pay", "journals:reverse")), true);
  assert.equal(canReversePayment(PAYMENT, holding("expenses:pay")), false);
  assert.equal(canReversePayment(PAYMENT, holding("journals:reverse", "expenses:update")), false);
  assert.equal(
    canReversePayment({ can_reverse: false }, holding("expenses:pay", "journals:reverse")),
    false,
  );
});

test("Payments shows once there is any payment, and each reads in words", () => {
  assert.equal(hasPayments(EXPENSE), true);
  assert.equal(hasPayments({ payments: [] }), false);
  assert.equal(hasPayments({}), false);
  assert.equal(paymentStatusLabel(PAYMENT), "Paid");
  assert.equal(paymentStatusLabel({ reversed: true }), "Reversed");
});

test("the payment dialog names the server's figures", () => {
  const text = reversalText({ kind: "payment", expense: EXPENSE, payment: PAYMENT });
  assert.equal(text.title, "Reverse this payment?");
  assert.equal(text.confirm, "Reverse payment");
  assert.ok(text.description.startsWith("₱4,000.00 paid to Meralco on Oct 5, 2026 (JE-000021)."), text.description);
  assert.ok(text.description.includes("puts the money back to Cash on Hand"), text.description);
});

test("the expense dialog says what reversing undoes", () => {
  const owed = reversalText({ kind: "expense", expense: EXPENSE });
  assert.equal(owed.title, "Reverse this expense?");
  assert.equal(owed.confirm, "Reverse expense");
  assert.ok(owed.description.startsWith("₱10,000.00 to Meralco, dated Oct 1, 2026."), owed.description);
  assert.ok(owed.description.includes("the cost and what is owed"), owed.description);

  const cash = reversalText({ kind: "expense", expense: { ...EXPENSE, payment_account_id: 3 } });
  assert.ok(cash.description.includes("puts the money back where it was paid from"), cash.description);
});

test("a reason is required, trimmed and kept within the server's limit", () => {
  assert.equal(reversalReason("  Paid twice "), "Paid twice");
  assert.equal(reversalReason("   "), null);
  assert.equal(reversalReason("a".repeat(REVERSAL_REASON_MAX)), "a".repeat(300));
  assert.equal(reversalReason("a".repeat(REVERSAL_REASON_MAX + 1)), null);
});

test("the More menu holds Payments, Edit, Reverse expense and Attachments by their own rules", () => {
  const all = holding("expenses:update", "journals:reverse", "expenses:pay");
  assert.deepEqual(expenseMenu(EXPENSE, all), {
    payments: true,
    edit: true,
    reverse: { shown: true, disabledReason: "Reverse its payments first: ₱4,000.00 paid in 1 payment." },
    attachments: true,
  });
  // A reversed expense: its payments and attachments stay; Edit and Reverse go.
  const reversed = {
    ...EXPENSE,
    status: "reversed" as const,
    can_edit: false,
    can_reverse: false,
    reverse_blocked_reason: null,
  };
  assert.deepEqual(expenseMenu(reversed, all), {
    payments: true,
    edit: false,
    reverse: { shown: false, disabledReason: null },
    attachments: true,
  });
  // A viewer: payments to read and attachments, nothing to change.
  assert.deepEqual(expenseMenu(EXPENSE, holding()), {
    payments: true,
    edit: false,
    reverse: { shown: false, disabledReason: null },
    attachments: true,
  });
  assert.equal(expenseMenu({ ...EXPENSE, payments: [] }, all).payments, false);
});

test("each row's More button is named for its payee", () => {
  assert.equal(moreActionsLabel("Meralco"), "More actions for Meralco");
});
