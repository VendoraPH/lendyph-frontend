/**
 * The Pay and Edit forms on the Expenses screen.
 *
 * Money stays the server's: the pay amount starts at the expense's
 * `amount_due` as the server sent it, and a typed amount is only parsed into
 * centavos, never compared with or taken from another figure. Whether it is
 * more than what's owed is the server's call (its 422 is shown as it is).
 */
import { fromCentavos, toCentavos } from "@/lib/accounting/money";
import type { Account, Expense } from "@/types";
import type { PayExpenseData } from "@/services/accounting.service";

/** Pay is offered only while the server says something is still owed. */
export function canPayExpense(expense: Pick<Expense, "amount_due">): boolean {
  return expense.amount_due > 0;
}

/** The server's amount due, written for the amount box ("1500.00"); blank when nothing is due. */
export function payAmountDefault(expense: Pick<Expense, "amount_due">): string {
  return canPayExpense(expense) ? fromCentavos(expense.amount_due).toFixed(2) : "";
}

/**
 * The money accounts a payment can come out of, as the server checks them:
 * active, not a heading, and carrying a cash kind. The cash accounts list
 * also holds inactive ones, for their balances.
 */
export function payFromAccounts(accounts: readonly Account[]): Account[] {
  return accounts.filter((a) => a.is_active && !a.is_group && Boolean(a.cash_kind));
}

export interface PayExpenseForm {
  date: string;
  /** As typed, in pesos. */
  amount: string;
  accountId: number | null;
}

/** The `payExpense()` body, or null while the form can't be sent. */
export function buildPayExpensePayload(form: PayExpenseForm): PayExpenseData | null {
  const amount = toCentavos(form.amount);
  if (!form.date || form.accountId === null || amount === null || amount <= 0) return null;
  return { date: form.date, amount, account_id: form.accountId };
}

/** What the New Expense form holds. Amounts stay as typed until they are parsed. */
export interface NewExpenseForm {
  date: string;
  payee: string;
  expenseAccountId: number | null;
  /** As typed, in pesos. */
  amount: string;
  paidNow: boolean;
  paymentAccountId: number | null;
  dueDate: string;
  reference: string;
  description: string;
}

/**
 * A blank New Expense, dated `today`, with "Paid now?" on. The dialog starts
 * from this every time it opens, so nothing carries over from the last entry.
 */
export function newExpenseForm(today: string): NewExpenseForm {
  return {
    date: today,
    payee: "",
    expenseAccountId: null,
    amount: "",
    paidNow: true,
    paymentAccountId: null,
    dueDate: "",
    reference: "",
    description: "",
  };
}

/** What `createExpense()` takes. Centavos. */
export interface NewExpensePayload {
  date: string;
  payee: string;
  expense_account_id: number;
  amount: number;
  payment_account_id: number | null;
  due_date: string | null;
  reference: string | null;
  description: string | null;
  /** Sent only for a `branches:view_all` caller; see `buildNewExpensePayload`. */
  branch_id?: number | null;
}

/**
 * The New Expense body, or null while the form can't be sent: a payee, an
 * expense category, an amount above zero, and the money account when it is
 * paid now. `branchId` is the branch a `branches:view_all` caller picked
 * (null: No branch); a branch user passes none, so nothing is sent and the
 * server records their own branch.
 */
export function buildNewExpensePayload(form: NewExpenseForm, branchId?: number | null): NewExpensePayload | null {
  const payee = form.payee.trim();
  const amount = toCentavos(form.amount);
  if (!payee || form.expenseAccountId === null || amount === null || amount <= 0) return null;
  if (form.paidNow && form.paymentAccountId === null) return null;

  const payload: NewExpensePayload = {
    date: form.date,
    payee,
    expense_account_id: form.expenseAccountId,
    amount,
    payment_account_id: form.paidNow ? form.paymentAccountId : null,
    due_date: form.paidNow ? null : form.dueDate || null,
    reference: form.reference.trim() || null,
    description: form.description.trim() || null,
  };
  if (branchId !== undefined) payload.branch_id = branchId;
  return payload;
}

/** The descriptive fields, the only ones an expense's edit can change. */
export interface ExpenseEditForm {
  payee: string;
  reference: string;
  description: string;
  dueDate: string;
}

export function expenseEditForm(expense: Expense): ExpenseEditForm {
  return {
    payee: expense.payee,
    reference: expense.reference ?? "",
    description: expense.description ?? "",
    dueDate: expense.due_date ?? "",
  };
}

export interface ExpenseEditPayload {
  payee: string;
  reference: string | null;
  description: string | null;
  due_date: string | null;
}

/**
 * The `updateExpense()` body: payee, reference, description and due date only.
 * The amount, accounts, date and branch belong to the recorded journal entry and
 * are never sent. A blanked field clears; a blank payee is refused.
 */
export function buildExpenseEditPayload(form: ExpenseEditForm): ExpenseEditPayload | null {
  const payee = form.payee.trim();
  if (!payee) return null;
  return {
    payee,
    reference: form.reference.trim() || null,
    description: form.description.trim() || null,
    due_date: form.dueDate || null,
  };
}
