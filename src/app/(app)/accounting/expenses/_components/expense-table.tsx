"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermission } from "@/hooks";
import { formatCentavos } from "@/lib/accounting/money";
import { formatDate } from "@/lib/format";
import type { Expense, ExpenseStatus } from "@/types";
import { expenseStatusLabel } from "../../_lib/display-labels";
import { centavosOrDash } from "../../_lib/server-figure";
import { JournalActionButton } from "../../journals/_components/journal-action-button";
import { canEditExpense, hasPayments, reverseExpenseState } from "../_lib/expense-actions";
import { canPayExpense } from "../_lib/expense-forms";

const STATUS_STYLES: Record<ExpenseStatus, string> = {
  unpaid: "bg-slate-500/10 text-slate-700 border-slate-500/30",
  partially_paid: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  paid: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  overdue: "bg-red-500/10 text-red-700 border-red-500/30",
  // The Journals screen's Reversed badge.
  reversed: "bg-orange-500/10 text-orange-700 border-orange-500/30",
};

interface ExpenseTableProps {
  rows: Expense[];
  onPay: (expense: Expense) => void;
  /** Open the expense's payments, where each can be reversed. */
  onPayments: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  /** Ask for a reason and reverse the expense. */
  onReverse: (expense: Expense) => void;
  /** Open the expense's attachments; offered to everyone who can see the list. */
  onAttachments: (expense: Expense) => void;
}

/**
 * One server page of expenses. Balance is the server's `amount_due`, and
 * which actions each row offers is the server's word (`can_edit`,
 * `can_reverse`) with the user's permissions.
 */
export function ExpenseTable({ rows, onPay, onPayments, onEdit, onReverse, onAttachments }: ExpenseTableProps) {
  const { can } = usePermission();
  // Pay needs `expenses:pay`, as the server's pay route does. It picks its
  // money account from the cash accounts list, so it needs
  // `cash_accounts:view` as well.
  const canPay = can("expenses:pay") && can("cash_accounts:view");

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">Date</TableHead>
          <TableHead>Payee</TableHead>
          <TableHead>Account</TableHead>
          <TableHead className="w-28">Due</TableHead>
          <TableHead className="w-32">Status</TableHead>
          <TableHead className="w-32 text-right">Amount</TableHead>
          <TableHead className="w-32 text-right">Balance</TableHead>
          <TableHead className="w-80 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((expense) => {
          const reverse = reverseExpenseState(expense, can);
          return (
            <TableRow key={expense.id}>
              <TableCell className="text-sm">{formatDate(expense.date)}</TableCell>
              <TableCell className="text-sm">
                {expense.payee}
                {expense.reference && (
                  <span className="block text-xs text-muted-foreground">{expense.reference}</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {expense.expense_account_name ?? "—"}
              </TableCell>
              <TableCell className="text-sm">
                {expense.due_date ? formatDate(expense.due_date) : "—"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={STATUS_STYLES[expense.status]}>
                  {expenseStatusLabel(expense.status)}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatCentavos(expense.amount)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm font-medium">
                {centavosOrDash(expense.amount_due)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {canPay && canPayExpense(expense) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPay(expense)}
                      aria-label={`Pay ${expense.payee}`}
                    >
                      Pay
                    </Button>
                  )}
                  {hasPayments(expense) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onPayments(expense)}
                      aria-label={`Payments for ${expense.payee}`}
                    >
                      Payments
                    </Button>
                  )}
                  {canEditExpense(expense, can) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEdit(expense)}
                      aria-label={`Edit ${expense.payee}`}
                    >
                      Edit
                    </Button>
                  )}
                  {reverse.shown && (
                    <JournalActionButton
                      state={reverse}
                      size="sm"
                      variant="ghost"
                      onClick={() => onReverse(expense)}
                      aria-label={`Reverse ${expense.payee}`}
                    >
                      Reverse
                    </JournalActionButton>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onAttachments(expense)}
                    aria-label={`Attachments for ${expense.payee}`}
                  >
                    Attachments
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
