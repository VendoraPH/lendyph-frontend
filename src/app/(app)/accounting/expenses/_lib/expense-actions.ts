/**
 * The actions an expense offers on Expenses & Payables, and the words of the
 * reversal dialog (finish run round 5).
 *
 * The server decides what is open (`can_edit`, `can_reverse`,
 * `reverse_blocked_reason`, each payment's `can_reverse`) and enforces it; the
 * screen also needs the user to hold the action's permissions. An action that
 * doesn't apply is hidden. Reverse expense waits, disabled with the server's
 * reason, while payments stand. Every figure is the server's, only formatted.
 */
import { formatCentavos } from "@/lib/accounting/money";
import { formatDate } from "@/lib/format";
import type { Expense, ExpensePayment, Permission } from "@/types";

export interface ExpenseActionState {
  shown: boolean;
  /** Why the shown button is disabled; null when it can be used. */
  disabledReason: string | null;
}

type Can = (permission: Permission) => boolean;

const HIDDEN: ExpenseActionState = { shown: false, disabledReason: null };
const READY: ExpenseActionState = { shown: true, disabledReason: null };

/** The server's limit on a reversal reason. */
export const REVERSAL_REASON_MAX = 300;

/**
 * Edit needs `expenses:update` and is hidden once the expense is reversed
 * (`can_edit: false`; without the flag, by its Reversed status).
 */
export function canEditExpense(expense: Pick<Expense, "can_edit" | "status">, can: Can): boolean {
  return can("expenses:update") && (expense.can_edit ?? expense.status !== "reversed");
}

/**
 * Reverse expense needs `expenses:update` and `journals:reverse`. It shows
 * while the server offers it: ready when `can_reverse`, disabled with the
 * server's reason while payments stand, hidden otherwise (already reversed).
 */
export function reverseExpenseState(
  expense: Pick<Expense, "can_reverse" | "reverse_blocked_reason">,
  can: Can,
): ExpenseActionState {
  if (!can("expenses:update") || !can("journals:reverse")) return HIDDEN;
  if (expense.can_reverse) return READY;
  const reason = expense.reverse_blocked_reason?.trim();
  return reason ? { shown: true, disabledReason: reason } : HIDDEN;
}

/** Reverse payment needs `expenses:pay` and `journals:reverse`, while the payment's journal stands. */
export function canReversePayment(payment: Pick<ExpensePayment, "can_reverse">, can: Can): boolean {
  return payment.can_reverse && can("expenses:pay") && can("journals:reverse");
}

/** Payments is offered once the expense has any, reversed ones included. */
export function hasPayments(expense: Pick<Expense, "payments">): boolean {
  return (expense.payments?.length ?? 0) > 0;
}

/**
 * What a row's More menu holds. Pay stays on the row as its primary action;
 * the rest sit in the menu, each by the same rules as on their own:
 * Payments once there is any, Edit while the server allows it, Reverse
 * expense shown or disabled with the server's reason, and Attachments for
 * everyone who can see the list.
 */
export interface ExpenseMenu {
  payments: boolean;
  edit: boolean;
  reverse: ExpenseActionState;
  attachments: true;
}

export function expenseMenu(
  expense: Pick<Expense, "payments" | "can_edit" | "status" | "can_reverse" | "reverse_blocked_reason">,
  can: Can,
): ExpenseMenu {
  return {
    payments: hasPayments(expense),
    edit: canEditExpense(expense, can),
    reverse: reverseExpenseState(expense, can),
    attachments: true,
  };
}

/** The More menu button's name, per row. */
export function moreActionsLabel(payee: string): string {
  return `More actions for ${payee}`;
}

/** A payment's state in words. */
export function paymentStatusLabel(payment: Pick<ExpensePayment, "reversed">): string {
  return payment.reversed ? "Reversed" : "Paid";
}

/** What is being reversed: the expense, or one of its payments. */
export type ExpenseReversal =
  | { kind: "expense"; expense: Expense }
  | { kind: "payment"; expense: Expense; payment: ExpensePayment };

export interface ReversalText {
  title: string;
  description: string;
  confirm: string;
  /** The success message. */
  done: string;
  /** Shown when the server can't be reached or answers without words. */
  fallback: string;
}

/** The reversal dialog's words, from the server's figures. */
export function reversalText(target: ExpenseReversal): ReversalText {
  if (target.kind === "payment") {
    const { expense, payment } = target;
    const from = payment.payment_account_name ? ` to ${payment.payment_account_name}` : "";
    const entry = payment.journal_no ? ` (${payment.journal_no})` : "";
    return {
      title: "Reverse this payment?",
      description:
        `${formatCentavos(payment.amount)} paid to ${expense.payee} on ${formatDate(payment.date)}${entry}. ` +
        `A reversing entry puts the money back${from}, and the amount is owed again. ` +
        "The payment stays on the record, marked Reversed.",
      confirm: "Reverse payment",
      done: "Payment reversed. The amount is owed again.",
      fallback: "Could not reverse this payment.",
    };
  }

  const { expense } = target;
  const paidOnTheSpot = expense.payment_account_id !== null;
  return {
    title: "Reverse this expense?",
    description:
      `${formatCentavos(expense.amount)} to ${expense.payee}, dated ${formatDate(expense.date)}. ` +
      (paidOnTheSpot
        ? "A reversing entry takes the cost out of the books and puts the money back where it was paid from. "
        : "A reversing entry takes the cost and what is owed out of the books. ") +
      "The expense stays on the list, marked Reversed, and counts in no total. If it is still owed, record it again.",
    confirm: "Reverse expense",
    done: "Expense reversed.",
    fallback: "Could not reverse this expense.",
  };
}

/** The reason as it is sent, or null while there is none to send. */
export function reversalReason(typed: string): string | null {
  const reason = typed.trim();
  return reason === "" || reason.length > REVERSAL_REASON_MAX ? null : reason;
}
