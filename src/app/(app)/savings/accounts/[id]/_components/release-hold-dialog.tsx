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
import { formatCurrency } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { savingsService } from "@/services";
import type { SavingsHold } from "@/types";
import { FormField } from "../../../_components/field";

interface ReleaseHoldDialogProps {
  /** The hold being released; null keeps the dialog closed. */
  hold: SavingsHold | null;
  onOpenChange: (open: boolean) => void;
  onReleased: () => void;
}

export function ReleaseHoldDialog({ hold, onOpenChange, onReleased }: ReleaseHoldDialogProps) {
  const open = hold !== null;
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  if (useDialogOpening(open, hold?.id)) {
    setReason("");
    setSubmitted(false);
  }

  const reasonError = reason.trim() ? null : "Say why the hold is being released.";

  function submit() {
    setSubmitted(true);
    if (!hold || reasonError) return;
    setSubmitting(true);
    savingsService
      .releaseHold(hold.id, { reason: reason.trim() })
      .then(() => {
        notifySuccess("Hold released", formatCurrency(hold.amount));
        onOpenChange(false);
        onReleased();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't release the hold."))
      .then(() => setSubmitting(false));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Release this hold?</DialogTitle>
          <DialogDescription>
            {hold
              ? `${formatCurrency(hold.amount)} held for "${hold.reason}" becomes available to withdraw again.`
              : null}
          </DialogDescription>
        </DialogHeader>

        <FormField id="release-reason" label="Reason" error={submitted ? reasonError : null}>
          <Textarea
            id="release-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. Loan LN-0042 fully paid"
          />
        </FormField>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Keep on hold
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Releasing…" : "Release hold"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
