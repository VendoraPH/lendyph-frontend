"use client";

import { useCallback, useState } from "react";
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
import { useAccountingResource, useDialogOpening } from "@/hooks";
import { formatCentavos } from "@/lib/accounting/money";
import { todayISO } from "@/lib/format";
import { accountingService } from "@/services";
import type { PayExpenseData } from "@/services/accounting.service";
import type { CashAccountPage, Expense } from "@/types";
import { CASH_ACCOUNTS_PER_PAGE, cashListIsIncomplete } from "../cash-bank/_lib/cash-bank";
import {
  buildPayExpensePayload,
  payAmountDefault,
  payFromAccounts,
} from "../expenses/_lib/expense-forms";
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
 * The money accounts come from `GET /accounting/cash-accounts`, read each time
 * the dialog opens, so the caller must also hold `cash_accounts:view`.
 *
 * The amount starts at what the server says is still owed. Whether a typed
 * amount is too much is the server's decision; its message is shown as it is.
 */
export function PayExpenseDialog({ expense, onOpenChange, onSubmit }: PayExpenseDialogProps) {
  const open = expense !== null;
  const fetcher = useCallback(
    () => accountingService.cashAccountsPage({ per_page: CASH_ACCOUNTS_PER_PAGE }),
    [],
  );
  const cash = useAccountingResource<CashAccountPage>(fetcher, open);

  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (useDialogOpening(open, expense) && expense) {
    setDate(todayISO());
    setAmount(payAmountDefault(expense));
    setAccountId(null);
  }

  const moneyAccounts = payFromAccounts(cash.data?.data ?? []);
  const accountsShort = cashListIsIncomplete(cash.data?.meta, (cash.data?.data ?? []).length);
  const payload = buildPayExpensePayload({ date, amount, accountId });

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

          {cash.loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Spinner className="h-4 w-4" />
              Loading money accounts…
            </p>
          )}
          {(cash.error || cash.unavailable) && (
            <p className="text-sm text-destructive" role="alert">
              The money accounts couldn&rsquo;t be loaded, so this can&rsquo;t be paid yet.
            </p>
          )}
          {accountsShort && (
            <p className="text-sm text-amber-700">
              Only the first {CASH_ACCOUNTS_PER_PAGE} money accounts are listed.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!payload || submitting}>
            {submitting && <Spinner className="mr-2 h-4 w-4" />}
            {submitting ? "Paying…" : "Record payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
