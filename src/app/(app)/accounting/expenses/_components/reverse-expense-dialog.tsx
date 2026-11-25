"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks";
import { runJournalAction } from "../../journals/_lib/journal-refusal";
import { REVERSAL_REASON_MAX, reversalReason, reversalText, type ExpenseReversal } from "../_lib/expense-actions";

interface ReverseExpenseDialogProps {
  /** The expense or payment being reversed; the dialog is open while this is set. */
  target: ExpenseReversal | null;
  onOpenChange: (open: boolean) => void;
  /** Posts the reversal. A rejection keeps the dialog open with the server's words. */
  onConfirm: (target: ExpenseReversal, reason: string) => Promise<void>;
  /** A 409 or 422 refusal: the expense may have changed, so the list reloads. */
  onRefused: () => void;
}

/**
 * Asks why an expense, or one of its payments, is being reversed, then
 * reverses it. The server posts the reversing entry and decides whether it can.
 */
export function ReverseExpenseDialog({ target, onOpenChange, onConfirm, onRefused }: ReverseExpenseDialogProps) {
  const open = target !== null;
  const [reason, setReason] = useState("");
  const [reversing, setReversing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (useDialogOpening(open, target)) {
    setReason("");
    setError(null);
  }

  const text = target ? reversalText(target) : null;
  const sent = reversalReason(reason);

  const confirm = () => {
    if (!target || !text || sent === null || reversing) return;
    setReversing(true);
    setError(null);
    runJournalAction(() => onConfirm(target, sent), onRefused, text.fallback).then((message) => {
      setError(message);
      setReversing(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !reversing && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{text?.title}</DialogTitle>
          <DialogDescription>{text?.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reverse-expense-reason">Why is this being reversed?</Label>
            <Textarea
              id="reverse-expense-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Paid twice, recorded in error, …"
              maxLength={REVERSAL_REASON_MAX}
              rows={3}
              aria-required="true"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={reversing}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={sent === null || reversing}>
            {reversing ? "Reversing…" : text?.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
