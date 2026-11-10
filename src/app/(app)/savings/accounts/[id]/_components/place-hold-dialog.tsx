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
import { parseMoneyInput } from "@/lib/money-input";
import { HOLD_TYPE_OPTIONS } from "../../../_lib/savings-rules";

interface PlaceHoldDialogProps {
  open: boolean;
  account: SavingsAccount;
  onOpenChange: (open: boolean) => void;
  onPlaced: () => void;
}

export function PlaceHoldDialog({ open, account, onOpenChange, onPlaced }: PlaceHoldDialogProps) {
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"manual" | "legal">("manual");
  const [reason, setReason] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  if (useDialogOpening(open, account.id)) {
    setAmount("");
    setType("manual");
    setReason("");
    setExpiresOn("");
    setSubmitted(false);
  }

  const today = todayISO();
  const parsed = parseMoneyInput(amount, { label: "Amount to hold" });
  const amountError = parsed.ok ? null : parsed.message;
  const dateError = expiresOn && expiresOn <= today ? "The hold must end after today, or leave the date blank." : null;
  const reasonError = reason.trim() ? null : "Say what the hold is for.";

  function submit() {
    setSubmitted(true);
    if (!parsed.ok || reasonError || dateError) return;
    setSubmitting(true);
    savingsService
      .placeHold(account.id, {
        type,
        amount: parsed.value,
        reason: reason.trim(),
        ...(expiresOn ? { expires_on: expiresOn } : {}),
      })
      .then(() => {
        notifySuccess("Hold placed", `${formatCurrency(parsed.value)} on ${account.account_number}`);
        onOpenChange(false);
        onPlaced();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't place the hold."))
      .then(() => setSubmitting(false));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Place a hold on {account.account_number}</DialogTitle>
          <DialogDescription>
            The amount stays in the account and keeps earning interest. It can&apos;t be withdrawn, and the
            account can&apos;t be closed, until the hold is released.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="hold-amount"
              label="Amount"
              error={submitted ? amountError : null}
              hint={`The balance is ${formatCurrency(account.balance)}, of which ${formatCurrency(account.hold_amount)} is already on hold.`}
            >
              <Input
                id="hold-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </FormField>
            <FormField
              id="hold-until"
              label="Until (optional)"
              hint="Leave blank to hold until released."
              error={submitted ? dateError : null}
            >
              <Input
                id="hold-until"
                type="date"
                value={expiresOn}
                min={today}
                onChange={(e) => setExpiresOn(e.target.value)}
              />
            </FormField>
          </div>
          <FormField id="hold-type" label="Type">
            <OptionSelect
              id="hold-type"
              value={type}
              onChange={(v) => setType(v === "legal" ? "legal" : "manual")}
              options={HOLD_TYPE_OPTIONS}
            />
          </FormField>
          <FormField id="hold-reason" label="Reason" error={submitted ? reasonError : null}>
            <Textarea
              id="hold-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Court order no. 123"
            />
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Placing…" : "Place hold"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
