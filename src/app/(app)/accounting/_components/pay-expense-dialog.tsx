"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useChartOfAccounts, useDialogOpening } from "@/hooks";
import { formatCentavos } from "@/lib/accounting/money";
import { todayISO } from "@/lib/format";
import type { PayExpenseData } from "@/services/accounting.service";
import type { Expense } from "@/types";
import { buildPayExpensePayload, payAmountDefault } from "../expenses/_lib/expense-forms";
import { AccountSelect } from "./account-select";

interface PayExpenseDialogProps {
  /** The expense being paid; the dialog is open while this is set. */
  expense: Expense | null;
  onOpenChange: (open: boolean) => void;
  /**
   * Must return the request's promise, and reject on failure so the dialog
   * stays open with what was typed (the caller shows the server's message).
   */
  onSubmit: (expense: Expense, data: PayExpenseData) => Promise<void>;
}

/**
 * Pay an expense, in full or in part, from a money account.
 *
 * The amount starts at what the server says is still owed. Whether a typed
 * amount is too much is the server's decision; its message is shown as it is.
 */
export function PayExpenseDialog({ expense, onOpenChange, onSubmit }: PayExpenseDialogProps) {
  const open = expense !== null;
  const { postable, isTemplate } = useChartOfAccounts();

  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (useDialogOpening(open, expense) && expense) {
    setDate(todayISO());
    setAmount(payAmountDefault(expense));
    setAccountId(null);
  }

  const moneyAccounts = postable.filter((a) => Boolean(a.cash_kind));
  const payload = buildPayExpensePayload({ date, amount, accountId });

  const submit = async () => {
    if (!expense || !payload || submitting || isTemplate) return;
    setSubmitting(true);
    try {
      await onSubmit(expense, payload);
    } catch {
      // The caller has already shown the server's message; the form stays.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay an expense</DialogTitle>
          <DialogDescription>
            {expense
              ? `${expense.payee}: ${formatCentavos(expense.amount_due)} still owed.`
              : "Record a payment against this expense."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pay-expense-date">Date paid</Label>
              <Input
                id="pay-expense-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-expense-amount">Amount</Label>
              <Input
                id="pay-expense-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="text-right font-mono"
              />
            </div>
          </div>

          <AccountSelect
            label="Paid from"
            accounts={moneyAccounts}
            value={accountId}
            onChange={setAccountId}
            className="w-full"
          />

          {isTemplate && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700">
              The chart of accounts has not been saved to the server yet, so
              this cannot be submitted.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!payload || isTemplate || submitting}>
            {submitting && <Spinner className="mr-2 h-4 w-4" />}
            {submitting ? "Paying…" : "Record payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
