"use client";

import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApiResource, useDialogOpening } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatCurrency, formatDateLong, todayISO } from "@/lib/format";
import { parseMoneyInput } from "@/lib/money-input";
import { notifyError, notifySuccess } from "@/lib/notify";
import { moneyPostMessage } from "@/lib/savings/money-post";
import { savingsService } from "@/services";
import type { SavingsAccount } from "@/types";
import { FormField } from "../../../_components/field";
import { OptionSelect } from "../../../_components/option-select";
import { outflowHoldNote } from "../../../_lib/savings-rules";
import { transferTargets } from "../_lib/transfer-targets";

interface TransferDialogProps {
  open: boolean;
  account: SavingsAccount;
  onOpenChange: (open: boolean) => void;
  onPosted: () => void;
}

/**
 * Move money to another savings account of the same member in the same
 * branch. Both legs post in one server transaction, or neither does. Adapted
 * from set A's transfer form (#500): the destination list comes from the
 * member's own accounts, and no balance after is worked out in the browser.
 */
export function TransferDialog({ open, account, onOpenChange, onPosted }: TransferDialogProps) {
  const [toId, setToId] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const [date, setDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, account.id)) {
    setToId("");
    setAmountRaw("");
    setDate(todayISO());
    setRemarks("");
    setConfirming(false);
    setSubmitted(false);
  }

  const fetchAccounts = useCallback(
    () => savingsService.accounts({ borrower_id: account.borrower_id, per_page: 100 }),
    [account.borrower_id],
  );
  const accounts = useApiResource(fetchAccounts, open);
  const targets = transferTargets(account, accounts.data?.data ?? []);
  const target = targets.find((t) => String(t.id) === toId) ?? null;

  const amount = parseMoneyInput(amountRaw, { label: "Transfer amount" });
  const errors = {
    to: target ? null : "Choose the account to transfer to.",
    amount: amount.ok ? null : amount.message,
    date: date ? null : "Enter the date.",
  };
  const valid = !errors.to && !errors.amount && !errors.date;

  function review() {
    setSubmitted(true);
    if (valid) setConfirming(true);
  }

  function submit() {
    if (!target || !amount.ok) return;
    const body = { to_account_id: target.id, amount: amount.value, date, remarks: remarks.trim() || undefined };
    run((key) => savingsService.transfer(account.id, body, key))
      ?.then((result) => {
        notifySuccess(moneyPostMessage(result, "Transfer posted"), formatCurrency(amount.value));
        onOpenChange(false);
        onPosted();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't post the transfer."));
  }

  const show = (error: string | null) => (submitted ? error : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer from {account.account_number}</DialogTitle>
          <DialogDescription>
            To another savings account of the same member in the same branch. Available to transfer:{" "}
            {formatCurrency(account.available_balance)}.
          </DialogDescription>
          {outflowHoldNote(account) && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{outflowHoldNote(account)}</p>
          )}
        </DialogHeader>

        {confirming && target && amount.ok ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border p-3 text-sm">
            <dt className="text-muted-foreground">From</dt>
            <dd className="font-mono">{account.account_number}</dd>
            <dt className="text-muted-foreground">To</dt>
            <dd className="font-mono">{target.account_number}</dd>
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(amount.value)}</dd>
            <dt className="text-muted-foreground">Date</dt>
            <dd>{formatDateLong(date)}</dd>
          </dl>
        ) : (
          <div className="space-y-4">
            <FormField
              id="tr-to"
              label="To account"
              error={show(errors.to)}
              hint={
                !accounts.loading && targets.length === 0
                  ? "This member has no other open savings account in this branch."
                  : undefined
              }
            >
              <OptionSelect
                id="tr-to"
                value={toId}
                onChange={setToId}
                options={targets.map((t) => ({ value: String(t.id), label: `${t.account_number} · ${t.product.name}` }))}
                placeholder={accounts.loading ? "Loading…" : "Choose an account"}
                disabled={accounts.loading || targets.length === 0}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="tr-amount" label="Amount" error={show(errors.amount)}>
                <Input
                  id="tr-amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amountRaw}
                  onChange={(e) => setAmountRaw(e.target.value)}
                />
              </FormField>
              <FormField id="tr-date" label="Date" error={show(errors.date)}>
                <Input id="tr-date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
              </FormField>
            </div>
            <FormField id="tr-remarks" label="Remarks (optional)">
              <Textarea id="tr-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
            </FormField>
          </div>
        )}

        <DialogFooter>
          {confirming ? (
            <>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={submitting}>
                Back
              </Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? "Posting…" : "Post transfer"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={review}>Review transfer</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
