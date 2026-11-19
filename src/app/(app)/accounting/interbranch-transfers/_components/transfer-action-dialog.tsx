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
import { formatCentavos } from "@/lib/accounting/money";
import { mintIdempotencyKey } from "@/lib/idempotency-key";
import { notifySuccess, notifyWarning } from "@/lib/notify";
import { interbranchTransferService } from "@/services";
import type { InterbranchTransfer } from "@/types/interbranch-transfer";
import { transferFailure, type TransferActionButton, type TransferActionKind } from "../_lib/transfers";

interface TransferActionDialogProps {
  /** The transfer and the step being taken; null when closed. */
  pending: { transfer: InterbranchTransfer; action: TransferActionButton } | null;
  onClose: () => void;
  /** After a successful step, named so the page reloads what it changed. */
  onDone: (step: TransferActionKind) => void;
}

/**
 * Confirms one step. Approve, receive and reverse post a journal, so the
 * dialog mints one Idempotency-Key as it opens and every retry sends it: a
 * second click after a lost answer gets the first answer back, never a second
 * posting. The server's refusal shows in its words.
 */
export function TransferActionDialog({ pending, onClose, onDone }: TransferActionDialogProps) {
  const open = pending !== null;
  const [text, setText] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (useDialogOpening(open, pending)) {
    setText("");
    setError(null);
    setKey(pending?.action.posts ? mintIdempotencyKey() : null);
  }

  async function confirm() {
    if (!pending) return;
    const { transfer, action } = pending;
    const words = text.trim();
    if (action.text && words === "") {
      setError(`${action.text.label} is needed.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const svc = interbranchTransferService;
      const result =
        action.kind === "approve"
          ? await svc.approve(transfer.id, key)
          : action.kind === "receive"
            ? await svc.receive(transfer.id, key)
            : action.kind === "reverse"
              ? await svc.reverse(transfer.id, words, key)
              : action.kind === "reject"
                ? await svc.reject(transfer.id, words)
                : await svc.cancel(transfer.id);
      notifySuccess(`${result.transfer.transfer_number}: ${result.transfer.status_label}.`);
      for (const warning of result.warnings) notifyWarning(warning);
      onClose();
      onDone(action.kind);
    } catch (err) {
      setError(transferFailure(err).general);
    } finally {
      setBusy(false);
    }
  }

  const transfer = pending?.transfer;
  const action = pending?.action;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {action?.label} {transfer?.transfer_number}?
          </DialogTitle>
          <DialogDescription>
            {transfer
              ? `${formatCentavos(transfer.amount)} from ${transfer.source_branch?.name ?? "the source branch"} to ${
                  transfer.destination_branch?.name ?? "the destination branch"
                }. `
              : ""}
            {action?.confirm}
          </DialogDescription>
        </DialogHeader>

        {action?.text ? (
          <div className="space-y-1.5">
            <Label htmlFor="ibt-action-text">{action.text.label}</Label>
            <Textarea
              id="ibt-action-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={action.text.max}
              rows={3}
              disabled={busy}
              aria-required="true"
            />
            <p className="text-[11px] text-muted-foreground">
              {text.length} of {action.text.max} characters.
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Back
          </Button>
          <Button
            onClick={confirm}
            disabled={busy}
            variant={action?.kind === "reject" || action?.kind === "reverse" || action?.kind === "cancel" ? "destructive" : "default"}
          >
            {busy ? "Working…" : action?.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
