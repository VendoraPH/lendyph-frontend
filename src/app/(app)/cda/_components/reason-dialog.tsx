"use client";

import { useState } from "react";
import { useDialogOpening } from "@/hooks";
import { notifyValidation } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  /** Resolve to close; reject to keep the dialog (and the typed reason) open. */
  onConfirm: (reason: string) => Promise<void>;
}

/** A required written reason, kept in the audit trail (return, reopen, …). */
export function ReasonDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm }: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (useDialogOpening(open, title)) setReason("");

  async function submit() {
    if (!reason.trim()) {
      notifyValidation(["Reason"]);
      return;
    }
    setBusy(true);
    const ok = await onConfirm(reason.trim()).then(
      () => true,
      () => false,
    );
    setBusy(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cda-reason">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea id="cda-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-24" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
