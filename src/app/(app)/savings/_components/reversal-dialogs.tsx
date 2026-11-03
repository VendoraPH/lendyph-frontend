"use client";

import { useState } from "react";
import { useDialogOpening, useSubmitGuard } from "@/hooks";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { savingsTransactionService } from "@/services/savings-transaction.service";
import type { SavingsTransaction } from "@/types/savings";
import { TRANSACTION_TYPE_LABEL } from "../_lib/account-status";
import { ConfirmActionDialog } from "./confirm-action-dialog";

export type ReversalAction = "reverse" | "approve" | "reject";

export interface ReversalTarget {
  action: ReversalAction;
  tx: SavingsTransaction;
}

interface ReversalDialogsProps {
  target: ReversalTarget | null;
  onClose: () => void;
  onDone: () => void;
}

const COPY: Record<ReversalAction, { title: string; label: string; description: string; error: string }> = {
  reverse: {
    title: "Reverse",
    label: "Reverse",
    description:
      "A reversal posts the opposite entry; the original stays on the ledger. When reversals need approval, it waits for a second user.",
    error: "The reversal could not be requested.",
  },
  approve: {
    title: "Approve reversal of",
    label: "Approve reversal",
    description: "The opposite entry is posted now and the account balance changes.",
    error: "The reversal could not be approved.",
  },
  reject: {
    title: "Reject reversal of",
    label: "Reject reversal",
    description: "The transaction stays posted and the request is closed.",
    error: "The reversal could not be rejected.",
  },
};

/** Reverse a transaction, or approve / reject a pending reversal. */
export function ReversalDialogs({ target, onClose, onDone }: ReversalDialogsProps) {
  const guard = useSubmitGuard();
  const [reason, setReason] = useState("");
  if (useDialogOpening(target !== null, target)) setReason("");

  const action = target?.action ?? "reverse";
  const copy = COPY[action];
  const tx = target?.tx;
  const needsReason = action !== "approve";

  const confirm = async () => {
    if (!tx) return;
    const why = reason.trim();
    if (action === "reverse") {
      const result = await guard.run((key) => savingsTransactionService.reverse(tx.id, why, key));
      if (!result) return;
      notifySuccess(
        result.status === "pending_approval" ? "Reversal sent for approval" : "Transaction reversed",
        tx.reference_number,
      );
    } else {
      const reversalId = tx.pending_reversal?.id;
      if (reversalId === undefined) return;
      // Through the guard too: a double-click must not send the decision twice.
      const done = await guard.run(() =>
        (action === "approve"
          ? savingsTransactionService.approveReversal(reversalId)
          : savingsTransactionService.rejectReversal(reversalId, why)
        ).then(() => true),
      );
      if (!done) return;
      notifySuccess(action === "approve" ? "Reversal approved" : "Reversal rejected", tx.reference_number);
    }
    onDone();
  };

  return (
    <ConfirmActionDialog
      open={target !== null}
      onOpenChange={(open) => !open && !guard.submitting && onClose()}
      title={tx ? `${copy.title} ${tx.reference_number}?` : ""}
      description={copy.description}
      confirmLabel={copy.label}
      destructive={action !== "approve"}
      errorFallback={copy.error}
      confirmDisabled={needsReason && !reason.trim()}
      onConfirm={confirm}
    >
      {tx && (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-2 rounded-md border p-3 text-sm">
            <dt className="text-muted-foreground">Type</dt>
            <dd>{TRANSACTION_TYPE_LABEL[tx.type]}</dd>
            <dt className="text-muted-foreground">Account</dt>
            <dd className="font-mono">{tx.account_number}</dd>
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="font-medium">{formatCurrency(Math.max(Number(tx.debit), Number(tx.credit)))}</dd>
            {tx.pending_reversal && (
              <>
                <dt className="text-muted-foreground">Requested by</dt>
                <dd>{tx.pending_reversal.requested_by?.name ?? "—"}</dd>
                <dt className="text-muted-foreground">Reason given</dt>
                <dd>{tx.pending_reversal.reason}</dd>
              </>
            )}
          </dl>
          {needsReason && (
            <div className="space-y-2">
              <Label htmlFor="reversal-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea id="reversal-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          )}
        </div>
      )}
    </ConfirmActionDialog>
  );
}
