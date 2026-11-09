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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useChartOfAccounts, useDialogOpening } from "@/hooks";
import { formatCentavos, toCentavos } from "@/lib/accounting/money";
import { formatDate, todayISO } from "@/lib/format";
import type { Expense } from "@/types";
import {
  buildExpenseEditPayload,
  expenseEditForm,
  newExpenseForm,
  type ExpenseEditForm,
  type ExpenseEditPayload,
  type NewExpenseForm,
} from "../expenses/_lib/expense-forms";
import { AccountSelect } from "./account-select";

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Must return the request's promise.
   *
   * `=> void` here discarded it, so the dialog could not tell that a request
   * was in flight and a second click recorded the expense twice. See the same
   * note on `TransferDialog`, where the duplicate is a second journal entry.
   */
  onSubmit: (data: Partial<Expense>) => Promise<void>;
}

/**
 * Record an expense, either paid on the spot or booked as a payable.
 *
 * The distinction is the only accounting decision the user makes here, and it
 * is asked in plain language ("Paid now?") rather than as a choice between
 * two journal shapes. Paid now credits the money account; unpaid credits
 * Accounts Payable and waits to be settled. Each opening starts blank, with
 * "Paid now?" on, so nothing carries over from the last entry.
 */
export function ExpenseDialog({ open, onOpenChange, onSubmit }: ExpenseDialogProps) {
  const { postable, isTemplate } = useChartOfAccounts();

  const [form, setForm] = useState<NewExpenseForm>(() => newExpenseForm(todayISO()));
  const [submitting, setSubmitting] = useState(false);

  if (useDialogOpening(open, null)) setForm(newExpenseForm(todayISO()));

  const set =
    <K extends keyof NewExpenseForm>(field: K) =>
    (value: NewExpenseForm[K]) =>
      setForm((prev) => ({ ...prev, [field]: value }));
  const {
    date,
    payee,
    expenseAccountId,
    amount,
    paidNow,
    paymentAccountId,
    dueDate,
    reference,
    description,
  } = form;
  const setDate = set("date");
  const setPayee = set("payee");
  const setExpenseAccountId = set("expenseAccountId");
  const setAmount = set("amount");
  const setPaidNow = set("paidNow");
  const setPaymentAccountId = set("paymentAccountId");
  const setDueDate = set("dueDate");
  const setReference = set("reference");
  const setDescription = set("description");

  const expenseAccounts = postable.filter((a) => a.type === "expense");
  const moneyAccounts = postable.filter((a) => Boolean(a.cash_kind));

  const amountCentavos = toCentavos(amount);
  const valid =
    payee.trim().length > 0 &&
    expenseAccountId !== null &&
    amountCentavos !== null &&
    amountCentavos > 0 &&
    (!paidNow || paymentAccountId !== null);

  const submit = async () => {
    if (submitting || !valid || isTemplate) return;
    setSubmitting(true);
    try {
      await onSubmit({
        date,
        payee: payee.trim(),
        expense_account_id: expenseAccountId,
        amount: amountCentavos,
        payment_account_id: paidNow ? paymentAccountId : null,
        due_date: paidNow ? null : dueDate || null,
        reference: reference.trim() || null,
        description: description.trim() || null,
      });
    } finally {
      // Whatever the request did, the button has to come back. A rejection
      // that left this true would wedge the dialog with no way out but a
      // reload.
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || isTemplate || submitting}>
            {submitting && <Spinner className="mr-2 h-4 w-4" />}
            {submitting ? "Recording…" : "Record expense"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface EditExpenseDialogProps {
  /** The expense being edited; the dialog is open while this is set. */
  expense: Expense | null;
  onOpenChange: (open: boolean) => void;
  /** Must return the request's promise, and reject on failure so the form stays. */
  onSubmit: (expense: Expense, data: ExpenseEditPayload) => Promise<void>;
}

const EMPTY_EDIT: ExpenseEditForm = { payee: "", reference: "", description: "", dueDate: "" };

/**
 * Edit an expense's descriptive fields: payee, reference, notes and due date.
 *
 * The amount, the accounts, the date and the branch are part of the journal
 * entry already recorded, so they are shown but can't be changed here.
 */
export function EditExpenseDialog({ expense, onOpenChange, onSubmit }: EditExpenseDialogProps) {
  const open = expense !== null;
  const [form, setForm] = useState<ExpenseEditForm>(EMPTY_EDIT);
  const [submitting, setSubmitting] = useState(false);

  if (useDialogOpening(open, expense) && expense) setForm(expenseEditForm(expense));

  const set = (field: keyof ExpenseEditForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const payload = buildExpenseEditPayload(form);

  const submit = async () => {
    if (!expense || !payload || submitting) return;
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit expense</DialogTitle>
          <DialogDescription>
            Only the payee, reference, notes and due date can be changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {expense && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <dt className="text-muted-foreground">Date</dt>
              <dd>{formatDate(expense.date)}</dd>
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="font-mono">{formatCentavos(expense.amount)}</dd>
              <dt className="text-muted-foreground">Expense category</dt>
              <dd>{expense.expense_account_name ?? "—"}</dd>
              <dd className="col-span-2 text-xs text-muted-foreground">
                The amount, accounts, date and branch are part of the journal
                entry already recorded, so they can&rsquo;t be edited.
              </dd>
            </dl>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-expense-payee">Paid to</Label>
            <Input
              id="edit-expense-payee"
              value={form.payee}
              onChange={(e) => set("payee")(e.target.value)}
              maxLength={160}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-expense-reference">Reference</Label>
            <Input
              id="edit-expense-reference"
              value={form.reference}
              onChange={(e) => set("reference")(e.target.value)}
              maxLength={64}
              placeholder="OR number, invoice number…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-expense-due">Due date</Label>
            <Input
              id="edit-expense-due"
              type="date"
              value={form.dueDate}
              onChange={(e) => set("dueDate")(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-expense-notes">Notes</Label>
            <Textarea
              id="edit-expense-notes"
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!payload || submitting}>
            {submitting && <Spinner className="mr-2 h-4 w-4" />}
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
