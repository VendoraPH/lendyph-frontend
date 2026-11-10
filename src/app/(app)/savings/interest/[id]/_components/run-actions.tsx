"use client";

import { useState } from "react";
import { DisabledReason } from "@/components/common/disabled-reason";
import { PermissionButton } from "@/components/common/permission-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatCurrency } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { savingsInterestService } from "@/services";
import { useAuthStore } from "@/store";
import type { InterestRun, Permission } from "@/types";
import { FormField } from "../../../_components/field";
import { runActions } from "../../_lib/run-rules";

type RunAction = "approve" | "reject" | "post" | "reverse";

const COPY: Record<
  RunAction,
  { title: string; label: string; description: string; error: string; done: string; permission: Permission; denied: string }
> = {
  approve: {
    title: "Approve this interest run?",
    label: "Approve",
    description: "Approving lets the run be posted. Nothing reaches the accounts until it is.",
    error: "Couldn't approve the run.",
    done: "Interest run approved",
    permission: "savings:approve",
    denied: "Approving needs the Savings approve permission",
  },
  reject: {
    title: "Reject this interest run?",
    label: "Reject",
    description: "The run is closed without posting, and the period can be run again.",
    error: "Couldn't reject the run.",
    done: "Interest run rejected",
    permission: "savings:approve",
    denied: "Rejecting needs the Savings approve permission",
  },
  post: {
    title: "Post this interest run?",
    label: "Post interest",
    description:
      "The server works the figures out again and credits each account's net interest and its tax. If any figure changed since approval, it refuses and nothing posts.",
    error: "Couldn't post the run.",
    done: "Interest posted",
    permission: "savings:post",
    denied: "Posting needs the Savings post interest permission",
  },
  reverse: {
    title: "Reverse this interest run?",
    label: "Reverse",
    description:
      "Writes reversal lines dated today for every credit in this run and reverses its journal. The original lines stay on the ledger. Only the latest posted run for its product and branch can be reversed.",
    error: "Couldn't reverse the run.",
    done: "Interest run reversed",
    permission: "savings:approve",
    denied: "Reversing needs the Savings approve permission",
  },
};

const NEEDS_REASON: ReadonlySet<RunAction> = new Set(["reject", "reverse"]);

function call(action: RunAction, id: number, reason: string) {
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

function ActionButton({
  action,
  blocked,
  onPick,
}: {
  action: RunAction;
  blocked?: string | null;
  onPick: (action: RunAction) => void;
}) {
  const copy = COPY[action];
  const destructive = action === "reject" || action === "reverse";
  const variant = action === "post" ? "default" : "outline";
  const className = destructive ? "text-destructive" : undefined;
  if (blocked) {
    return (
      <DisabledReason reason={blocked}>
        <Button variant={variant} className={className} disabled>
          {copy.label}
        </Button>
      </DisabledReason>
    );
  }
  return (
    <PermissionButton
      permission={copy.permission}
      tooltip={copy.denied}
      variant={variant}
      className={className}
      onClick={() => onPick(action)}
    >
      {copy.label}
    </PermissionButton>
  );
}

/** Approve, reject, post or reverse a run, as its status allows. */
export function RunActions({ run, onChanged }: { run: InterestRun; onChanged: () => void }) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const guard = useSubmitGuard();
  const [action, setAction] = useState<RunAction | null>(null);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  if (useDialogOpening(action !== null, action)) {
    setReason("");
    setSubmitted(false);
  }

  const offered = runActions(run, userId);
  const copy = action ? COPY[action] : null;
  const needsReason = action !== null && NEEDS_REASON.has(action);
  const reasonError = needsReason && !reason.trim() ? "Say why." : null;

  const confirm = () => {
    setSubmitted(true);
    if (!action || reasonError) return;
    const chosen = action;
    guard
      .run(() => call(chosen, run.id, reason.trim()))
      ?.then(() => {
        notifySuccess(COPY[chosen].done);
        setAction(null);
        onChanged();
      })
      .catch((err: unknown) => notifyError(err, COPY[chosen].error));
  };

  if (!offered.approve && !offered.reject && !offered.post && !offered.reverse) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {offered.approve && <ActionButton action="approve" blocked={offered.approveBlocked} onPick={setAction} />}
      {offered.reject && <ActionButton action="reject" onPick={setAction} />}
      {offered.post && <ActionButton action="post" onPick={setAction} />}
      {offered.reverse && <ActionButton action="reverse" onPick={setAction} />}

      <Dialog open={action !== null} onOpenChange={(open) => !open && setAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{copy?.title}</DialogTitle>
            <DialogDescription>
              {copy?.description} Net interest: {formatCurrency(run.total_net)} across {run.account_count} account(s).
            </DialogDescription>
          </DialogHeader>
          {needsReason && (
            <FormField id="run-reason" label="Reason" error={submitted ? reasonError : null}>
              <Textarea id="run-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </FormField>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={guard.submitting}>
              Cancel
            </Button>
            <Button
              variant={action === "reject" || action === "reverse" ? "destructive" : "default"}
              onClick={confirm}
              disabled={guard.submitting}
            >
              {guard.submitting ? "Working…" : copy?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
