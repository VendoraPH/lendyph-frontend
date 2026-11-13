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
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatDateLong } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { moneyPostMessage } from "@/lib/savings/money-post";
import { feeOf, totalWithFeeOf, withFeeText } from "@/lib/savings/withdrawal-fee";
import { savingsService } from "@/services";
import type { SavingsTransaction } from "@/types";
import { FormField } from "./field";
import { TRANSACTION_TYPE_LABELS, isNilAmount, labelOf } from "../_lib/savings-rules";

interface ReverseTransactionDialogProps {
  transaction: SavingsTransaction | null;
  onOpenChange: (open: boolean) => void;
  onRequested: () => void;
}

/**
 * Ask to reverse a posted line. Nothing moves yet: the server answers 202 with
 * an approval, and the reversal posts only once another user approves it.
 */
export function ReverseTransactionDialog({ transaction, onOpenChange, onRequested }: ReverseTransactionDialogProps) {
  const open = transaction !== null;
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, transaction?.id ?? null)) {
    setReason("");
    setSubmitted(false);
  }

  const reasonError = reason.trim() ? null : "Say why this line should be reversed.";
  const amount = transaction ? (isNilAmount(transaction.debit) ? transaction.credit : transaction.debit) : "0.00";

  function submit() {
    setSubmitted(true);
    if (!transaction || reasonError) return;
    run((key) => savingsService.requestReversal(transaction.id, reason.trim(), key))
      ?.then((result) => {
        notifySuccess(moneyPostMessage(result, "Reversal posted"), transaction.reference);
        onOpenChange(false);
        onRequested();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't request the reversal."));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reverse {transaction?.reference}?</DialogTitle>
          <DialogDescription>
            {transaction
              ? `${labelOf(TRANSACTION_TYPE_LABELS, transaction.type)} of ${withFeeText(amount, feeOf(transaction), totalWithFeeOf(transaction))} on ${formatDateLong(transaction.date)}.${feeOf(transaction) ? " Reversing it reverses the fee too." : ""} The original line is kept; a reversal line posts once another user approves the request.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <FormField id="rev-reason" label="Reason" error={submitted ? reasonError : null}>
          <Textarea id="rev-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            {submitting ? "Sending…" : "Request reversal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
