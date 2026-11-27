"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { Account } from "@/types";

interface AccountStatusDialogProps {
  /** The account to deactivate or reactivate; the dialog is open while set. */
  account: Account | null;
  onClose: () => void;
  /** Must return the request's promise, and reject on failure so the dialog stays. */
  onConfirm: (account: Account, isActive: boolean) => Promise<void>;
}

/**
 * Deactivate or reactivate an account. Deactivating is the safe path for an
 * account with history: its entries stay, and it leaves every picker.
 */
export function AccountStatusDialog({ account, onClose, onConfirm }: AccountStatusDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const deactivating = account?.is_active ?? true;

  const confirm = async () => {
    if (!account || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(account, !account.is_active);
    } catch {
      // The caller has already shown the server's message.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={account !== null} onOpenChange={(next) => !submitting && !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {deactivating ? "Deactivate" : "Reactivate"} {account?.code} {account?.name}?
          </DialogTitle>
          <DialogDescription>
            {deactivating
              ? "Its past entries and balance stay. It can't be picked for new entries until it is reactivated."
              : "It can be picked for new entries again."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={deactivating ? "destructive" : "default"}
            onClick={confirm}
            disabled={submitting}
          >
            {submitting && <Spinner className="mr-2 h-4 w-4" />}
            {deactivating ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
