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
import { DataState } from "@/components/common/data-state";
import { useApiResource, useDialogOpening } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatCurrency, todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { moneyPostMessage } from "@/lib/savings/money-post";
import { savingsService } from "@/services";
import type { SavingsAccount, SavingsMethod } from "@/types";
import { FormField } from "../../../_components/field";
import { OptionSelect } from "../../../_components/option-select";
import { PAYMENT_METHOD_OPTIONS } from "../../../_lib/savings-rules";

interface CloseAccountDialogProps {
  open: boolean;
  account: SavingsAccount;
  onOpenChange: (open: boolean) => void;
  onClosed: () => void;
}

type PayoutMethod = Exclude<SavingsMethod, "savings">;

/**
 * Close an account on the server's closing quote: the accrued interest is
 * credited first, then the balance is paid out. Above the approval amount the
 * close waits for approval (202).
 */
export function CloseAccountDialog({ open, account, onOpenChange, onClosed }: CloseAccountDialogProps) {
  const [date, setDate] = useState("");
  const [method, setMethod] = useState<PayoutMethod>("cash");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, account)) {
    setDate(todayISO());
    setMethod("cash");
    setReason("");
    setSubmitted(false);
  }

  const fetchQuote = useCallback(() => savingsService.closingQuote(account.id), [account.id]);
  const quote = useApiResource(fetchQuote, open);

  const reasonError = reason.trim() ? null : "Say why the account is being closed.";
  const canClose = quote.data?.can_close === true;

  function submit() {
    setSubmitted(true);
    if (reasonError || !date || !canClose) return;
    const body = { date, reason: reason.trim(), payout_method: method };
    run((key) => savingsService.close(account.id, body, key))
      ?.then((result) => {
        notifySuccess(moneyPostMessage(result, "Account closed"), account.account_number);
        onOpenChange(false);
        onClosed();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't close the account."));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Close {account.account_number}?</DialogTitle>
          <DialogDescription>
            The accrued interest is credited first, then the balance is paid out. A closed account takes no
            further transactions. Above the approval amount, the close waits for approval.
          </DialogDescription>
        </DialogHeader>

        <DataState
          resource={quote}
          endpoints={["GET /savings/accounts/{id}/closing-quote"]}
          summary="What closing pays out will show here once the savings service is connected."
        >
          {(q) => (
            <div className="space-y-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border p-3 text-sm">
                <dt className="text-muted-foreground">Balance</dt>
                <dd className="text-right tabular-nums">{formatCurrency(q.balance)}</dd>
                <dt className="text-muted-foreground">Interest credited at close</dt>
                <dd className="text-right tabular-nums">{formatCurrency(q.accrued_interest)}</dd>
                <dt className="text-muted-foreground">Withholding tax</dt>
                <dd className="text-right tabular-nums">{formatCurrency(q.withholding_tax)}</dd>
                <dt className="font-medium">Paid out</dt>
                <dd className="text-right font-semibold tabular-nums">{formatCurrency(q.payout_amount)}</dd>
              </dl>
              {!q.can_close && q.blockers.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-destructive" role="alert">
                  {q.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </DataState>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="cl-date" label="Closing date">
              <Input id="cl-date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
            </FormField>
            <FormField id="cl-method" label="Paid out by">
              <OptionSelect
                id="cl-method"
                value={method}
                onChange={(v) => setMethod(v as PayoutMethod)}
                options={PAYMENT_METHOD_OPTIONS}
              />
            </FormField>
          </div>
          <FormField id="cl-reason" label="Reason" error={submitted ? reasonError : null}>
            <Textarea id="cl-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Keep open
          </Button>
          <Button variant="destructive" onClick={submit} disabled={submitting || !canClose}>
            {submitting ? "Closing…" : "Close account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
