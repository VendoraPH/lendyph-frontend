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
import { notifyError, notifySuccess } from "@/lib/notify";
import type { AccountingAttachment } from "@/types/accounting";

interface AttachmentRemoveDialogProps {
  /** The attachment being removed; null keeps the dialog closed. */
  attachment: AccountingAttachment | null;
  /** A posted or reversed journal, or an expense: the reason is required and audited. */
  needsReason: boolean;
  validateReason: (reason: string) => string | null;
  onRemove: (attachment: AccountingAttachment, reason: string) => Promise<unknown>;
  /** How a failed removal reads, and whether the list must be read again. */
  failure: (err: unknown) => { message: string; reload: boolean };
  onClose: () => void;
  /** The list changed (or may have): read it again. */
  onDone: () => void;
}

/** Confirms a removal: a plain confirm on a draft, a required reason otherwise. */
export function AttachmentRemoveDialog({ attachment, onClose, ...rest }: AttachmentRemoveDialogProps) {
  return (
    <Dialog open={attachment !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {attachment && (
          <RemoveForm key={attachment.id} attachment={attachment} onClose={onClose} {...rest} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RemoveForm({
  attachment,
  needsReason,
  validateReason,
  onRemove,
  failure,
  onClose,
  onDone,
}: AttachmentRemoveDialogProps & { attachment: AccountingAttachment }) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [removing, setRemoving] = useState(false);
  const problem = validateReason(reason);
  const fieldId = `attachment-remove-reason-${attachment.id}`;

  const confirm = () => {
    setTouched(true);
    if (problem) return;
    setRemoving(true);
    onRemove(attachment, reason).then(
      () => {
        notifySuccess("Attachment removed.");
        setRemoving(false);
        onClose();
        onDone();
      },
      (err: unknown) => {
        const outcome = failure(err);
        notifyError(null, outcome.message);
        setRemoving(false);
        if (outcome.reload) {
          onClose();
          onDone();
        }
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Remove this attachment?</DialogTitle>
        <DialogDescription>
          {attachment.original_filename} will be removed from this record
          {needsReason ? ", and the reason is kept in the Audit Trail." : "."}
        </DialogDescription>
      </DialogHeader>
      {needsReason && (
        <div className="space-y-1.5">
          <Label htmlFor={fieldId}>Why is this attachment being removed?</Label>
          <Textarea
            id={fieldId}
            value={reason}
            maxLength={500}
            required
            aria-invalid={touched && problem ? true : undefined}
            aria-describedby={touched && problem ? `${fieldId}-error` : undefined}
            onChange={(e) => setReason(e.target.value)}
          />
          {touched && problem && (
            <p id={`${fieldId}-error`} className="text-xs text-destructive">
              {problem}
            </p>
          )}
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" disabled={removing} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="destructive" disabled={removing} onClick={confirm}>
          {removing ? "Removing…" : "Remove"}
        </Button>
      </DialogFooter>
    </>
  );
}
