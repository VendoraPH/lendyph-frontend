"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { notifyError, notifySuccess } from "@/lib/notify";

interface ActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  /** Shown as a toast once `onConfirm` resolves. */
  successMessage: string;
  /** Shown with the server's reason when `onConfirm` rejects. */
  errorMessage: string;
  /** Leave the confirm button disabled until the form is complete. */
  canConfirm?: boolean;
  destructive?: boolean;
  onConfirm: () => Promise<unknown>;
  /** Called after a successful confirm, before the dialog closes. */
  onDone?: () => void;
  /** Called after a failed confirm, once the server's words are shown (a 409 reloads the page's record). */
  onFailed?: (err: unknown) => void;
  size?: "default" | "md" | "lg";
  children?: React.ReactNode;
}

/**
 * The one dialog every application action uses: a form body, a confirm
 * button that shows progress, and the toast either way. It stays open on a
 * failure so nothing typed is lost.
 */
export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  successMessage,
  errorMessage,
  canConfirm = true,
  destructive = false,
  onConfirm,
  onDone,
  onFailed,
  size = "default",
  children,
}: ActionDialogProps) {
  const [busy, setBusy] = useState(false);

  const confirm = () => {
    setBusy(true);
    onConfirm()
      .then(() => {
        notifySuccess(successMessage);
        onDone?.();
        onOpenChange(false);
      })
      .catch((err) => {
        notifyError(err, errorMessage);
        onFailed?.(err);
      })
      .then(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children && <div className="space-y-3 overflow-y-auto">{children}</div>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={confirm}
            disabled={busy || !canConfirm}
          >
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
