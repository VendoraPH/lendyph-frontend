"use client";

import { useState } from "react";
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
import { useDialogOpening } from "@/hooks";
import { formatCurrency, todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { savingsService } from "@/services";
import type { SavingsAccount } from "@/types";
import { FormField } from "../../../_components/field";
import { OptionSelect } from "../../../_components/option-select";
import { PAYMENT_METHOD_OPTIONS } from "../../../_lib/savings-rules";

interface CloseAccountDialogProps {
  open: boolean;
  account: SavingsAccount;
  onOpenChange: (open: boolean) => void;
  onClosed: () => void;
}

export function CloseAccountDialog({ open, account, onOpenChange, onClosed }: CloseAccountDialogProps) {
  const [date, setDate] = useState("");
  const [method, setMethod] = useState("cash");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  if (useDialogOpening(open, account)) {
    setDate(todayISO());
    setMethod("cash");
    setReason("");
    setSubmitted(false);
  }

  const reasonError = reason.trim() ? null : "Say why the account is being closed.";

  function submit() {
    setSubmitted(true);
    if (reasonError || !date) return;
    setSubmitting(true);
    savingsService
      .closeAccount(account.id, { date, reason: reason.trim(), payout_method: method })
      .then(() => {
        notifySuccess("Account closed", account.account_number);
        onOpenChange(false);
        onClosed();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't close the account."))
      .then(() => setSubmitting(false));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Close {account.account_number}?</DialogTitle>
          <DialogDescription>
            The balance of {formatCurrency(account.balance)} plus accrued interest of{" "}
            {formatCurrency(account.accrued_interest)} is paid out, less any closing fee and
            withholding tax. The server posts the final figures; a closed account takes no further
            transactions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="cl-date" label="Closing date">
              <Input id="cl-date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
            </FormField>
            <FormField id="cl-method" label="Paid out by">
              <OptionSelect id="cl-method" value={method} onChange={setMethod} options={PAYMENT_METHOD_OPTIONS} />
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
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            {submitting ? "Closing…" : "Close account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
