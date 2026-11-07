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
import {
  PAYMENT_METHOD_OPTIONS,
  parseAmountInput,
  withdrawalProblem,
} from "../../../_lib/savings-rules";

export type TransactionMode = "deposit" | "withdrawal";

interface TransactionDialogProps {
  mode: TransactionMode | null;
  account: SavingsAccount;
  onOpenChange: (open: boolean) => void;
  onPosted: () => void;
}

const COPY: Record<TransactionMode, { title: string; verb: string; method: string; done: string }> = {
  deposit: { title: "Deposit", verb: "Post deposit", method: "Received by", done: "Deposit posted" },
  withdrawal: { title: "Withdrawal", verb: "Post withdrawal", method: "Paid out by", done: "Withdrawal posted" },
};

export function TransactionDialog({ mode, account, onOpenChange, onPosted }: TransactionDialogProps) {
  const open = mode !== null;
  const [amountRaw, setAmountRaw] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  if (useDialogOpening(open, mode)) {
    setAmountRaw("");
    setDate(todayISO());
    setMethod("cash");
    setReference("");
    setRemarks("");
    setSubmitted(false);
  }

  const amount = parseAmountInput(amountRaw);
  const amountError =
    mode === "withdrawal" ? withdrawalProblem(amount, account) : amount === null ? "Enter an amount." : null;
  const dateError = date ? null : "Enter the date.";
  const copy = COPY[mode ?? "deposit"];

  function submit() {
    setSubmitted(true);
    if (!mode || amountError || dateError || amount === null) return;
    setSubmitting(true);
    const post = mode === "deposit" ? savingsService.deposit : savingsService.withdraw;
    post(account.id, {
      amount,
      date,
      payment_method: method,
      reference: reference.trim() || undefined,
      remarks: remarks.trim() || undefined,
    })
      .then(() => {
        notifySuccess(copy.done, formatCurrency(amount));
        onOpenChange(false);
        onPosted();
      })
      .catch((err: unknown) => notifyError(err, `Couldn't post the ${mode}.`))
      .then(() => setSubmitting(false));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {copy.title} · {account.account_number}
          </DialogTitle>
          <DialogDescription>
            {mode === "withdrawal"
              ? `Available to withdraw: ${formatCurrency(account.available_balance)} (after holds and the maintaining balance).`
              : `Current balance: ${formatCurrency(account.balance)}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="tx-amount" label="Amount" error={submitted ? amountError : null}>
              <Input
                id="tx-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amountRaw}
                onChange={(e) => setAmountRaw(e.target.value)}
                autoFocus
              />
            </FormField>
            <FormField id="tx-date" label="Date" error={submitted ? dateError : null}>
              <Input id="tx-date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="tx-method" label={copy.method}>
              <OptionSelect id="tx-method" value={method} onChange={setMethod} options={PAYMENT_METHOD_OPTIONS} />
            </FormField>
            <FormField id="tx-ref" label="Reference (optional)">
              <Input id="tx-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="OR / transfer no." />
            </FormField>
          </div>
          <FormField id="tx-remarks" label="Remarks (optional)">
            <Textarea id="tx-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Posting…" : copy.verb}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
