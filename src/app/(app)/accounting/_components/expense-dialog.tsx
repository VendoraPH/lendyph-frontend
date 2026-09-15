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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useChartOfAccounts } from "@/hooks";
import { toCentavos } from "@/lib/accounting/money";
import { todayISO } from "@/lib/format";
import type { Expense } from "@/types";
import { AccountSelect } from "./account-select";

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<Expense>) => void;
}

/**
 * Record an expense, either paid on the spot or booked as a payable.
 *
 * The distinction is the only accounting decision the user makes here, and it
 * is asked in plain language ("Paid now?") rather than as a choice between
 * two journal shapes. Paid now credits the money account; unpaid credits
 * Accounts Payable and waits to be settled.
 */
export function ExpenseDialog({ open, onOpenChange, onSubmit }: ExpenseDialogProps) {
  const { postable, isTemplate } = useChartOfAccounts();

  const [date, setDate] = useState(todayISO());
  const [payee, setPayee] = useState("");
  const [expenseAccountId, setExpenseAccountId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [paidNow, setPaidNow] = useState(true);
  const [paymentAccountId, setPaymentAccountId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");

  const expenseAccounts = postable.filter((a) => a.type === "expense");
  const moneyAccounts = postable.filter((a) => Boolean(a.cash_kind));

  const amountCentavos = toCentavos(amount);
  const valid =
    payee.trim().length > 0 &&
    expenseAccountId !== null &&
    amountCentavos !== null &&
    amountCentavos > 0 &&
    (!paidNow || paymentAccountId !== null);

  const submit = () => {
    if (!valid || isTemplate) return;
    onSubmit({
      date,
      payee: payee.trim(),
      expense_account_id: expenseAccountId,
      amount: amountCentavos,
      payment_account_id: paidNow ? paymentAccountId : null,
      due_date: paidNow ? null : dueDate || null,
      reference: reference.trim() || null,
      description: description.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record an expense</DialogTitle>
          <DialogDescription>
            Lendy writes the journal entry behind this for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="expense-date">Date</Label>
              <Input
                id="expense-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-amount">Amount</Label>
              <Input
                id="expense-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="text-right font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-payee">Paid to</Label>
            <Input
              id="expense-payee"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder="Meralco, landlord, supplier…"
            />
          </div>

          <AccountSelect
            label="Expense category"
            accounts={expenseAccounts}
            value={expenseAccountId}
            onChange={setExpenseAccountId}
            className="w-full"
          />

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Paid now?</p>
              <p className="text-xs text-muted-foreground">
                Off means this is owed and will show as a payable.
              </p>
            </div>
            <Switch checked={paidNow} onCheckedChange={setPaidNow} />
          </div>

          {paidNow ? (
            <AccountSelect
              label="Paid from"
              accounts={moneyAccounts}
              value={paymentAccountId}
              onChange={setPaymentAccountId}
              className="w-full"
            />
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="expense-due">Due date</Label>
              <Input
                id="expense-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="expense-reference">Reference</Label>
            <Input
              id="expense-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="OR number, invoice number…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-notes">Notes</Label>
            <Textarea
              id="expense-notes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {isTemplate && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700">
              The chart of accounts has not been saved to the server yet, so
              this cannot be submitted — the account ids shown are from the
              default template.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || isTemplate}>
            Record expense
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
