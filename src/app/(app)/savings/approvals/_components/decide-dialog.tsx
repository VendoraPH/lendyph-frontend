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
import { formatCurrency } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { savingsApprovalService } from "@/services";
import type { SavingsApproval } from "@/types";
import { FormField } from "../../_components/field";
import { APPROVAL_KIND_LABELS, labelOf } from "../../_lib/savings-rules";
import { approvalSubject } from "../_lib/approval-rules";

export type Decision = "approve" | "reject" | "cancel";

const COPY: Record<Decision, { title: string; button: string; done: string; needsReason: boolean }> = {
  approve: { title: "Approve", button: "Approve", done: "Approved", needsReason: false },
  reject: { title: "Reject", button: "Reject", done: "Rejected", needsReason: true },
  cancel: { title: "Cancel your request", button: "Cancel request", done: "Request cancelled", needsReason: false },
};

interface DecideDialogProps {
  approval: SavingsApproval | null;
  decision: Decision;
  onOpenChange: (open: boolean) => void;
  onDecided: () => void;
}

/**
 * Approve, reject or cancel one request. Approving re-checks the money under
 * the server's lock, so it may still be refused (422) if the funds are gone;
 * the server's words are shown.
 */
export function DecideDialog({ approval, decision, onOpenChange, onDecided }: DecideDialogProps) {
  const open = approval !== null;
  const copy = COPY[decision];
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, approval?.id ?? null)) {
    setReason("");
    setSubmitted(false);
  }

  const reasonError = copy.needsReason && !reason.trim() ? "Give the reason." : null;

  function submit() {
    setSubmitted(true);
    if (!approval || reasonError) return;
    const id = approval.id;
    const call =
      decision === "approve"
        ? () => savingsApprovalService.approve(id)
        : decision === "reject"
          ? () => savingsApprovalService.reject(id, reason.trim())
          : () => savingsApprovalService.cancel(id, reason.trim() || undefined);
    run(call)
      ?.then((result) => {
        const stillPending = decision === "approve" && result.status === "pending";
        notifySuccess(stillPending ? "Approved. It needs one more approver before it posts." : copy.done);
        onOpenChange(false);
        onDecided();
      })
      .catch((err: unknown) => notifyError(err, `Couldn't ${copy.button.toLowerCase()}.`));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {copy.title}: {approval ? labelOf(APPROVAL_KIND_LABELS, approval.kind) : ""}
          </DialogTitle>
          <DialogDescription>
            {approval
              ? `${approvalSubject(approval)} · ${formatCurrency(approval.amount)}${approval.borrower_name ? ` · ${approval.borrower_name}` : ""}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {decision !== "approve" && (
          <FormField
            id="ap-reason"
            label={copy.needsReason ? "Reason" : "Reason (optional)"}
            error={submitted ? reasonError : null}
          >
            <Textarea id="ap-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </FormField>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Back
          </Button>
          <Button variant={decision === "approve" ? "default" : "destructive"} onClick={submit} disabled={submitting}>
            {submitting ? "Saving…" : copy.button}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
