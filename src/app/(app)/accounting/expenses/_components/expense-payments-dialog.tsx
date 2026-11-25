"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { Expense, ExpensePayment } from "@/types";
import { centavosOrDash } from "../../_lib/server-figure";
import { canReversePayment, paymentStatusLabel } from "../_lib/expense-actions";

interface ExpensePaymentsDialogProps {
  /** The expense whose payments are listed; the dialog is open while this is set. */
  expense: Expense | null;
  onOpenChange: (open: boolean) => void;
  /** Ask for a reason and reverse this payment. */
  onReverse: (expense: Expense, payment: ExpensePayment) => void;
}

/**
 * An expense's payments, as the server lists them, reversed ones included.
 * A payment whose journal stands can be reversed here; the server decides.
 */
export function ExpensePaymentsDialog({ expense, onOpenChange, onReverse }: ExpensePaymentsDialogProps) {
  const { can } = usePermission();
  const payments = expense?.payments ?? [];

  return (
    <Dialog open={expense !== null} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Payments</DialogTitle>
          <DialogDescription>
            {expense
              ? `${expense.payee}: ${centavosOrDash(expense.amount_paid)} paid, ${centavosOrDash(expense.amount_due)} still owed. A reversed payment no longer counts.`
              : "The payments made on this expense."}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Paid from</TableHead>
                <TableHead className="w-28">Entry</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-32 text-right">Amount</TableHead>
                <TableHead className="w-28 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="text-sm">{formatDate(payment.date)}</TableCell>
                  <TableCell className="text-sm">{payment.payment_account_name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{payment.journal_no ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        payment.reversed
                          ? "border-orange-500/30 bg-orange-500/10 text-orange-700"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                      }
                    >
                      {paymentStatusLabel(payment)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatCentavos(payment.amount)}</TableCell>
                  <TableCell className="text-right">
                    {expense && canReversePayment(payment, can) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReverse(expense, payment)}
                        aria-label={`Reverse the payment of ${formatCentavos(payment.amount)} on ${formatDate(payment.date)}`}
                      >
                        Reverse
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
