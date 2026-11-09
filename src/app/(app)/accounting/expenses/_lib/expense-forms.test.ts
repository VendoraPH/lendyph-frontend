import { test } from "node:test";
import assert from "node:assert/strict";
import type { Account, Expense } from "@/types";
import {
  buildExpenseEditPayload,
  buildPayExpensePayload,
  canPayExpense,
  expenseEditForm,
  newExpenseForm,
  payAmountDefault,
  payFromAccounts,
} from "./expense-forms";

const EXPENSE: Expense = {
  id: 7,
  date: "2026-11-01",
  payee: "Meralco",
  expense_account_id: 51,
  expense_account_name: "5050 Utilities",
  amount: 250_000,
  amount_paid: 100_000,
  payment_account_id: null,
  branch_id: 2,
  reference: "INV-1",
  description: "October bill",
  due_date: "2026-11-30",
  status: "partially_paid",
  journal_id: 90,
  amount_due: 150_000,
};

test("the pay amount starts at the server's amount due, in pesos for the input", () => {
  assert.equal(payAmountDefault(EXPENSE), "1500.00");
  assert.equal(payAmountDefault({ ...EXPENSE, amount_due: 1 }), "0.01");
  assert.equal(payAmountDefault({ ...EXPENSE, amount_due: 123_456_789 }), "1234567.89");
});

test("the pay amount reads the server's figure, never amount less amount paid", () => {
  // A server that has already settled part of it elsewhere answers a smaller
  // amount due than the two fields suggest; the default follows the server.
  assert.equal(payAmountDefault({ ...EXPENSE, amount_due: 50_000 }), "500.00");
});

test("an expense with nothing due offers no default and can't be paid", () => {
  assert.equal(payAmountDefault({ ...EXPENSE, amount_due: 0 }), "");
  assert.equal(canPayExpense({ ...EXPENSE, amount_due: 0 }), false);
  assert.equal(canPayExpense(EXPENSE), true);
});

test("the pay payload is the date, whole centavos and the money account", () => {
  assert.deepEqual(
    buildPayExpensePayload({ date: "2026-11-09", amount: "1,500.50", accountId: 3 }),
    { date: "2026-11-09", amount: 150_050, account_id: 3 },
  );
  assert.deepEqual(
    buildPayExpensePayload({ date: "2026-11-09", amount: "₱ 20", accountId: 3 }),
    { date: "2026-11-09", amount: 2_000, account_id: 3 },
  );
});

test("the pay payload is refused before sending when a field is missing or not an amount", () => {
  const ok = { date: "2026-11-09", amount: "10.00", accountId: 3 };
  assert.equal(buildPayExpensePayload({ ...ok, accountId: null }), null);
  assert.equal(buildPayExpensePayload({ ...ok, date: "" }), null);
  assert.equal(buildPayExpensePayload({ ...ok, amount: "" }), null);
  assert.equal(buildPayExpensePayload({ ...ok, amount: "0" }), null);
  assert.equal(buildPayExpensePayload({ ...ok, amount: "-5" }), null);
  assert.equal(buildPayExpensePayload({ ...ok, amount: "ten" }), null);
});

test("the edit form starts from the expense's descriptive fields", () => {
  assert.deepEqual(expenseEditForm(EXPENSE), {
    payee: "Meralco",
    reference: "INV-1",
    description: "October bill",
    dueDate: "2026-11-30",
  });
  assert.deepEqual(
    expenseEditForm({ ...EXPENSE, reference: null, description: undefined, due_date: null }),
    { payee: "Meralco", reference: "", description: "", dueDate: "" },
  );
});

test("the edit payload carries only payee, reference, description and due date", () => {
  const payload = buildExpenseEditPayload({
    payee: "  Meralco Inc. ",
    reference: " INV-2 ",
    description: " November ",
    dueDate: "2026-12-01",
  });
  assert.deepEqual(payload, {
    payee: "Meralco Inc.",
    reference: "INV-2",
    description: "November",
    due_date: "2026-12-01",
  });
  assert.deepEqual(Object.keys(payload ?? {}).sort(), [
    "description",
    "due_date",
    "payee",
    "reference",
  ]);
});

test("the edit payload clears a blanked field and refuses a blank payee", () => {
  assert.deepEqual(
    buildExpenseEditPayload({ payee: "Landlord", reference: " ", description: "", dueDate: "" }),
    { payee: "Landlord", reference: null, description: null, due_date: null },
  );
  assert.equal(
    buildExpenseEditPayload({ payee: "   ", reference: "", description: "", dueDate: "" }),
    null,
  );
});

test("pay offers only active money accounts that can take a posting", () => {
  const base: Account = {
    id: 1,
    code: "1010",
    name: "Cash on Hand",
    type: "asset",
    normal_balance: "debit",
    is_contra: false,
    parent_id: null,
    is_group: false,
    is_active: true,
    cash_kind: "cash",
  };
  const accounts: Account[] = [
    base,
    { ...base, id: 2, code: "1030", name: "Old Bank", cash_kind: "bank", is_active: false },
    { ...base, id: 3, code: "1000", name: "Cash heading", is_group: true },
    { ...base, id: 4, code: "1040", name: "GCash", cash_kind: "gcash" },
    { ...base, id: 5, code: "1100", name: "Receivable", cash_kind: null },
  ];
  assert.deepEqual(
    payFromAccounts(accounts).map((a) => a.id),
    [1, 4],
  );
});

test("a New Expense opens blank, dated today, with Paid now on", () => {
  assert.deepEqual(newExpenseForm("2026-11-09"), {
    date: "2026-11-09",
    payee: "",
    expenseAccountId: null,
    amount: "",
    paidNow: true,
    paymentAccountId: null,
    dueDate: "",
    reference: "",
    description: "",
  });
});
