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
import { REACTIVATION_SENT_TEXT } from "@/lib/savings/status-change";
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

/**
 * Freeze, unfreeze or ask to reactivate an account, with a reason. Audited by
 * the server. Reactivating a dormant account starts an approval (202) instead
 * of changing it.
 */
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
      ?.then((result) => {
        if (result.kind === "sent_for_approval") {
          // A staff reactivation waits for a checker (gap round S4); nothing has changed yet.
          notifySuccess("Sent for approval", result.message ?? REACTIVATION_SENT_TEXT);
        } else {
          // Unfreezing can return a once-dormant account to dormant: say what the server set.
          notifySuccess(
            `Account is now ${labelOf(ACCOUNT_STATUS_LABELS, result.account.status).toLowerCase()}`,
            account.account_number,
          );
        }
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
                ? "Reactivation needs a checker: it is sent for approval, and the account stays dormant until another user approves it. Once approved, it counts as member activity that day."
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
            {submitting ? "Saving…" : offer?.label === "Reactivate" ? "Send for approval" : (offer?.label ?? "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
