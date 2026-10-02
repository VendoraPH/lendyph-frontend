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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { reminderService } from "@/services";
import type { ReminderPauseScope } from "@/types/reminder";

interface PauseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: ReminderPauseScope;
  borrowerId?: number;
  loanId?: number;
  /** What is being paused, e.g. "Juan Dela Cruz" or "LN-2026-00123". */
  targetLabel?: string;
  onPaused: () => void;
}

const SCOPE_COPY: Record<ReminderPauseScope, { title: string; body: string }> = {
  global: {
    title: "Pause all reminders",
    body: "No automated reminder goes to any borrower until someone resumes them. Manual reminders are blocked too.",
  },
  borrower: {
    title: "Pause reminders for this borrower",
    body: "Stops automated reminders for every loan this borrower holds.",
  },
  loan: {
    title: "Pause reminders for this loan",
    body: "Stops automated reminders for this loan only. The borrower's other loans are unaffected.",
  },
};

/** Pause at any scope. A reason is required; it goes on the audit trail. */
export function PauseDialog({
  open,
  onOpenChange,
  scope,
  borrowerId,
  loanId,
  targetLabel,
  onPaused,
}: PauseDialogProps) {
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [saving, setSaving] = useState(false);

  if (useDialogOpening(open, scope)) {
    setReason("");
    setUntil("");
  }

  const copy = SCOPE_COPY[scope];

  const submit = () => {
    if (!reason.trim()) {
      notifyValidation(["Reason"]);
      return;
    }
    setSaving(true);
    reminderService
      .pause({
        scope,
        borrower_id: borrowerId,
        loan_id: loanId,
        reason: reason.trim(),
        until: until || null,
      })
      .then(() => {
        setSaving(false);
        notifySuccess("Reminders paused");
        onOpenChange(false);
        onPaused();
      })
      .catch((err) => {
        setSaving(false);
        notifyError(err, "Could not pause reminders.");
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {targetLabel ? <span className="font-medium text-foreground">{targetLabel}. </span> : null}
            {copy.body}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pause-reason">Reason</Label>
            <Textarea
              id="pause-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Borrower is under restructuring negotiation"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pause-until">Resume automatically on (optional)</Label>
            <Input id="pause-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>
            {saving ? "Pausing…" : "Pause reminders"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
