"use client";

import { useState, type ReactNode } from "react";
import { notifyError } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  /** Resolve to close; a rejection is shown as a toast and keeps it open. */
  onConfirm: () => Promise<void>;
  errorFallback: string;
  /** Keep the confirm button off, e.g. until a required reason is entered. */
  confirmDisabled?: boolean;
  children?: ReactNode;
}

/**
 * A yes/no confirmation for one savings action. The button locks while the
 * request is in flight so a double click can't send it twice.
 */
export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  errorFallback,
  confirmDisabled,
  children,
}: ConfirmActionDialogProps) {
  const [busy, setBusy] = useState(false);

  const confirm = () => {
    if (busy || confirmDisabled) return;
    setBusy(true);
    onConfirm()
      .then(() => onOpenChange(false))
      .catch((err: unknown) => notifyError(err, errorFallback))
      .then(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={confirm}
            disabled={busy || confirmDisabled}
            className={
              destructive
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            }
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
