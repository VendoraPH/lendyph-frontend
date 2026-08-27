// src/app/(app)/borrowers/registrations/[id]/_components/reject-dialog.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

// Mirrors RejectBorrowerRequest: 'reason' => ['required', 'string', 'max:1000'].
// Enforced here too so an over-long reason is caught before the round trip.
const REASON_MAX_LENGTH = 1000;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Receives the trimmed reason. Must surface its own errors, and must throw
   * on failure — that is how this dialog knows to stay open and keep the
   * reason the operator typed.
   */
  onConfirm: (reason: string) => Promise<void>;
}

export function RejectDialog({ open, onOpenChange, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmedReason = reason.trim();
  const canSubmit = trimmedReason.length > 0 && !submitting;

  async function handleConfirm() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onConfirm(trimmedReason);
      // The caller closes the dialog on success by flipping `open` directly
      // rather than going through handleOpenChange, so clear here as well —
      // otherwise the old text is still sitting there if it reopens.
      setReason("");
    } catch {
      // Already reported by the caller. Swallow it so the operator isn't told
      // twice, and keep the typed reason so a retry doesn't start from blank.
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (submitting) return;
    if (!next) setReason("");
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="text-destructive">Reject Registration</DialogTitle>
          <DialogDescription>
            The application is marked as rejected rather than deleted, and your
            reason is recorded against it.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-1">
          <Label htmlFor="rejection-reason">
            Reason for rejection
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </Label>
          <Textarea
            id="rejection-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this application is being rejected..."
            maxLength={REASON_MAX_LENGTH}
            required
            disabled={submitting}
            aria-describedby="rejection-reason-hint"
            className="mt-1.5"
          />
          <p
            id="rejection-reason-hint"
            className="mt-1.5 text-xs text-muted-foreground"
          >
            Recorded against the application for future reference.{" "}
            {/* Counts the trimmed value, since that is what is actually sent. */}
            {trimmedReason.length}/{REASON_MAX_LENGTH} characters.
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canSubmit}
          >
            {submitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rejecting...</>
            ) : (
              "Confirm Rejection"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
