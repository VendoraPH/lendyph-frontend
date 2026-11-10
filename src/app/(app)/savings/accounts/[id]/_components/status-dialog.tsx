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
import { statusChangeOffer } from "../../../_lib/savings-rules";

interface StatusDialogProps {
  open: boolean;
  account: SavingsAccount;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

/** Freeze an account, or unfreeze it, with a reason. Audited by the server. */
export function StatusDialog({ open, account, onOpenChange, onChanged }: StatusDialogProps) {
  const offer = statusChangeOffer(account);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, account.id)) {
    setReason("");
    setSubmitted(false);
  }

  const reasonError = reason.trim() ? null : "Give the reason.";

  function submit() {
    setSubmitted(true);
    if (!offer || reasonError) return;
    run(() => savingsService.setStatus(account.id, { status: offer.status, reason: reason.trim() }))
      ?.then(() => {
        notifySuccess(offer.status === "frozen" ? "Account frozen" : "Account unfrozen", account.account_number);
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
              ? "A frozen account takes no deposits, withdrawals or transfers until it is unfrozen. It keeps earning interest."
              : "The account takes deposits, withdrawals and transfers again."}
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
