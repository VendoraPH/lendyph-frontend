"use client";

import { useState } from "react";
import { usePermission, useDialogOpening, useSubmitGuard } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { savingsInterestService } from "@/services/savings-interest.service";
import { useAuthStore } from "@/store";
import type { InterestBatch } from "@/types/savings";
import { ConfirmActionDialog } from "../../../_components/confirm-action-dialog";
import { batchActions } from "../../../_lib/interest-batch";

type BatchAction = "approve" | "reject" | "post" | "reverse";

const COPY: Record<BatchAction, { title: string; label: string; description: string; error: string; done: string }> = {
  approve: {
    title: "Approve interest batch",
    label: "Approve",
    description: "Approving lets the batch be posted. Nothing reaches the accounts until it is.",
    error: "The batch could not be approved.",
    done: "Interest batch approved",
  },
  reject: {
    title: "Reject interest batch",
    label: "Reject",
    description: "The batch is closed without posting. Create a new one to try again.",
    error: "The batch could not be rejected.",
    done: "Interest batch rejected",
  },
  post: {
    title: "Post interest batch",
    label: "Post interest",
    description: "Credits each account's interest and books it to the ledger. A batch posts once.",
    error: "The batch could not be posted.",
    done: "Interest posted",
  },
  reverse: {
    title: "Reverse interest batch",
    label: "Reverse",
    description: "Posts the opposite of every interest credit in this batch. The original entries stay on the ledger.",
    error: "The batch could not be reversed.",
    done: "Interest batch reversed",
  },
};

const NEEDS_REASON: ReadonlySet<BatchAction> = new Set(["reject", "reverse"]);

function call(action: BatchAction, id: number, reason: string) {
  switch (action) {
    case "approve":
      return savingsInterestService.approve(id);
    case "reject":
      return savingsInterestService.reject(id, reason);
    case "post":
      return savingsInterestService.post(id);
    case "reverse":
      return savingsInterestService.reverse(id, reason);
  }
}

/** Approve, reject, post or reverse a batch, as its status and the viewer allow. */
export function BatchActions({ batch, onChanged }: { batch: InterestBatch; onChanged: () => void }) {
  const { can } = usePermission();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const guard = useSubmitGuard();
  const [action, setAction] = useState<BatchAction | null>(null);
  const [reason, setReason] = useState("");
  if (useDialogOpening(action !== null, action)) setReason("");

  const actions = batchActions(batch, { canApprove: can("savings:approve"), canPost: can("savings:post"), userId });
  const copy = COPY[action ?? "approve"];
  const needsReason = action !== null && NEEDS_REASON.has(action);

  const confirm = async () => {
    if (!action) return;
    const done = await guard.run(() => call(action, batch.id, reason.trim()));
    if (!done) return;
    notifySuccess(copy.done, batch.reference_number);
    onChanged();
  };

  const review = actions.approve && (
    <span className="inline-flex gap-2">
      <Button variant="outline" onClick={() => setAction("approve")} disabled={actions.ownBatch}>
        Approve
      </Button>
      <Button variant="outline" className="text-destructive" onClick={() => setAction("reject")} disabled={actions.ownBatch}>
        Reject
      </Button>
    </span>
  );

  return (
    <>
      {review && actions.ownBatch ? (
        <Tooltip>
          <TooltipTrigger render={<span tabIndex={0} />}>{review}</TooltipTrigger>
          <TooltipContent>You created this batch; another user must review it.</TooltipContent>
        </Tooltip>
      ) : (
        review
      )}
      {actions.post && (
        <Button
          onClick={() => setAction("post")}
          className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
        >
          Post interest
        </Button>
      )}
      {actions.reverse && (
        <Button variant="outline" className="text-destructive" onClick={() => setAction("reverse")}>
          Reverse batch
        </Button>
      )}
      <ConfirmActionDialog
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
        title={`${copy.title} ${batch.reference_number}?`}
        description={`${copy.description} Total: ${formatCurrency(batch.totals.total_interest)} across ${batch.totals.eligible_accounts} account(s).`}
        confirmLabel={copy.label}
        destructive={action === "reject" || action === "reverse"}
        errorFallback={copy.error}
        confirmDisabled={needsReason && !reason.trim()}
        onConfirm={confirm}
      >
        {needsReason && (
          <div className="space-y-2">
            <Label htmlFor="batch-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea id="batch-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
      </ConfirmActionDialog>
    </>
  );
}
