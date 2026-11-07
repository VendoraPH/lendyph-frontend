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
import { formatCurrency, formatRate, todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { savingsService } from "@/services";
import type { TimeDeposit } from "@/types";
import { FormField } from "../../../_components/field";
import { OptionSelect } from "../../../_components/option-select";
import { PAYMENT_METHOD_OPTIONS } from "../../../_lib/savings-rules";

interface PreterminateDialogProps {
  open: boolean;
  deposit: TimeDeposit;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

export function PreterminateDialog({ open, deposit, onOpenChange, onDone }: PreterminateDialogProps) {
  const [date, setDate] = useState("");
  const [method, setMethod] = useState("cash");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  if (useDialogOpening(open, deposit)) {
    setDate(todayISO());
    setMethod("cash");
    setReason("");
    setSubmitted(false);
  }

  const dateOk = date !== "" && date < deposit.maturity_date;
  const fetchQuote = useCallback(() => savingsService.preterminationQuote(deposit.id, date), [deposit.id, date]);
  const quote = useApiResource(fetchQuote, open && dateOk);
  const reasonError = reason.trim() ? null : "Say why the placement is being broken early.";

  function submit() {
    setSubmitted(true);
    if (reasonError || !dateOk) return;
    setSubmitting(true);
    savingsService
      .preterminateTimeDeposit(deposit.id, { date, reason: reason.trim(), payout_method: method })
      .then(() => {
        notifySuccess("Time deposit pre-terminated", deposit.certificate_number);
        onOpenChange(false);
        onDone();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't pre-terminate the time deposit."))
      .then(() => setSubmitting(false));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pre-terminate {deposit.certificate_number}?</DialogTitle>
          <DialogDescription>
            Breaking the placement before maturity pays interest at the pre-termination rate
            {deposit.pretermination_rate != null && ` (${formatRate(deposit.pretermination_rate)}% a year)`} for the days
            held, less withholding tax and any penalty. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="pt-date" label="Date" error={date && !dateOk ? "On or after maturity, settle it instead." : null}>
              <Input id="pt-date" type="date" value={date} min={deposit.placement_date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
            </FormField>
            <FormField id="pt-method" label="Paid out by">
              <OptionSelect id="pt-method" value={method} onChange={setMethod} options={PAYMENT_METHOD_OPTIONS} />
            </FormField>
          </div>
          <FormField id="pt-reason" label="Reason" error={submitted ? reasonError : null}>
            <Textarea id="pt-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </FormField>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            {!dateOk ? (
              <p className="text-muted-foreground">Pick a date before maturity to see the payout.</p>
            ) : quote.loading ? (
              <p className="text-muted-foreground">Working out the payout…</p>
            ) : quote.data ? (
              <dl className="space-y-1">
                {[
                  [`Interest for ${quote.data.days_held} days at ${formatRate(quote.data.rate)}%`, quote.data.gross_interest],
                  ["Less withholding tax", quote.data.withholding_tax],
                  ["Less penalty", quote.data.penalty],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="tabular-nums">{formatCurrency(value)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t pt-1 font-semibold">
                  <dt>Paid to the member</dt>
                  <dd className="tabular-nums">{formatCurrency(quote.data.payout)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-muted-foreground">
                {quote.unavailable
                  ? "The payout quote isn't connected yet. The server computes the figures when you confirm."
                  : "Couldn't load the payout quote. The server still computes the figures when you confirm."}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Keep placement
          </Button>
          <Button variant="destructive" onClick={submit} disabled={submitting || !dateOk}>
            {submitting ? "Pre-terminating…" : "Pre-terminate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
