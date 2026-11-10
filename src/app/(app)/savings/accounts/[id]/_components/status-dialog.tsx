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
import { notifyError, notifySuccess } from "@/lib/notify";
import { savingsService } from "@/services";
import type { SavingsAccount } from "@/types";
import { FormField } from "../../../_components/field";
import { ACCOUNT_STATUS_LABELS, labelOf, type StatusOffer } from "../../../_lib/savings-rules";

interface StatusDialogProps {
  /** The change asked for, or null while closed. */
  offer: StatusOffer | null;
  account: SavingsAccount;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

/** Freeze, unfreeze or reactivate an account, with a reason. Audited by the server. */
export function StatusDialog({ offer, account, onOpenChange, onChanged }: StatusDialogProps) {
  const open = offer !== null;
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, offer?.label ?? null)) {
    setReason("");
    setSubmitted(false);
  }

  const reasonError = reason.trim() ? null : "Give the reason.";

  function submit() {
    setSubmitted(true);
    if (!offer || reasonError) return;
    run(() => savingsService.setStatus(account.id, { status: offer.status, reason: reason.trim() }))
      ?.then((changed) => {
        // Unfreezing can return a once-dormant account to dormant: say what the server set.
        notifySuccess(`Account is now ${labelOf(ACCOUNT_STATUS_LABELS, changed.status).toLowerCase()}`, account.account_number);
        onOpenChange(false);
        onChanged();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't change the account's status."));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {offer?.label ?? "Change status"} {account.account_number}?
          </DialogTitle>
          <DialogDescription>
            {offer?.status === "frozen"
              ? "A frozen account takes no deposits, withdrawals, transfers or reversals until it is unfrozen. It keeps earning interest."
              : offer?.label === "Reactivate"
                ? "The account becomes active again, counted as member activity today."
                : "The account takes transactions again. One that was dormant before it was frozen goes back to dormant."}
          </DialogDescription>
        </DialogHeader>
        <FormField id="st-reason" label="Reason" error={submitted ? reasonError : null}>
          <Textarea id="st-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || !offer}>
            {submitting ? "Saving…" : (offer?.label ?? "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
