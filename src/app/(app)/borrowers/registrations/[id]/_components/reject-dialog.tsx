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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function RejectDialog({ open, onOpenChange, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (reason.trim().length < 10) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!submitting) {
      if (!open) setReason("");
      onOpenChange(open);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="text-destructive">Reject Registration</DialogTitle>
          <DialogDescription>
            Provide a reason for rejecting this application. This will be logged for record-keeping.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="rejection_reason">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="rejection_reason"
            placeholder="e.g. Incomplete or incorrect information provided..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className={reason.trim().length > 0 && reason.trim().length < 10 ? "border-destructive" : ""}
          />
          {reason.trim().length > 0 && reason.trim().length < 10 && (
            <p className="text-xs text-destructive">Reason must be at least 10 characters.</p>
          )}
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
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
            disabled={submitting || reason.trim().length < 10}
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
