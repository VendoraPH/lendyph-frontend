"use client";

import { useState } from "react";
import { PermissionButton } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermission } from "@/hooks";
import { formatDate } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { accountingService } from "@/services";
import type { AllowancePreview } from "@/types";
import {
  ALLOWANCE_PERMISSION,
  POST_PERMISSION_REASON,
  canPostAllowance,
  confirmLines,
  postFailure,
  postFromPreview,
  postState,
} from "../_lib/allowance";

interface PostAllowancePanelProps {
  preview: AllowancePreview;
  onPosted: () => void;
  onConflict: () => void;
  /** A 422 on `as_of`: the page shows the server's words beside the As of date. */
  onDateRefused: (message: string) => void;
}

/**
 * Posts one adjustment per branch for the preview's date. The server decides
 * whether it can, and the preview's own total goes with the request, so a
 * figure that moved since is refused (409) instead of posted.
 */
export function PostAllowancePanel({
  preview,
  onPosted,
  onConflict,
  onDateRefused,
}: PostAllowancePanelProps) {
  const { can } = usePermission();
  const [confirming, setConfirming] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = postState(preview, canPostAllowance(can));
  const lines = confirmLines(preview);

  const open = () => {
    setError(null);
    setConfirming(true);
  };

  const post = () => {
    setPosting(true);
    setError(null);
    postFromPreview(preview, accountingService.postAllowance)
      .then(() => {
        setConfirming(false);
        notifySuccess("Allowance posted.");
        onPosted();
      })
      .catch((err: unknown) => {
        const failure = postFailure(err);
        if (failure.kind === "conflict") {
          setConfirming(false);
          onConflict();
        } else if (failure.field === "as_of") {
          setConfirming(false);
          onDateRefused(failure.message);
        } else {
          setError(failure.message);
        }
      })
      .then(() => setPosting(false));
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Post the allowance</p>
          <p className="text-sm text-muted-foreground">
            Posts each branch&apos;s adjustment as of {formatDate(preview.as_of)}, one journal per
            branch.
          </p>
        </div>
        <PermissionButton
          permission={ALLOWANCE_PERMISSION}
          tooltip={POST_PERMISSION_REASON}
          onClick={open}
          disabled={!state.enabled}
        >
          Post the allowance
        </PermissionButton>
      </div>
      {/* The button's tooltip always carries it; said here only when the server listed nothing. */}
      {state.reason && state.reasons.length === 0 && (
        <p className="text-sm text-muted-foreground">{state.reason}.</p>
      )}
      {state.reasons.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {state.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      <Dialog open={confirming} onOpenChange={(next) => !posting && setConfirming(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post the allowance?</DialogTitle>
            <DialogDescription>
              As of {formatDate(preview.as_of)}, each branch&apos;s allowance moves to its required
              amount. Balances on journals with no branch are left as they are.
            </DialogDescription>
          </DialogHeader>
          <dl className="divide-y rounded-lg border text-sm">
            {lines.branches.map((line) => (
              <div key={line.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <dt>{line.name}</dt>
                <dd className="font-mono">{line.text}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 px-3 py-2 font-medium">
              <dt>Total</dt>
              <dd className="font-mono">{lines.total}</dd>
            </div>
          </dl>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={posting}>
              Cancel
            </Button>
            <Button onClick={post} disabled={posting}>
              {posting ? "Posting…" : "Post"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
