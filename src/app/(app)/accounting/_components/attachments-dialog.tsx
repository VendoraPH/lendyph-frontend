"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Expense } from "@/types";
import { AttachmentsPanel } from "./attachments-panel";

interface AttachmentsDialogProps {
  /** The expense whose attachments are shown; null keeps the dialog closed. */
  expense: Expense | null;
  onOpenChange: (open: boolean) => void;
}

/** An expense's attachments, opened from its row on the Expenses page. */
export function AttachmentsDialog({ expense, onOpenChange }: AttachmentsDialogProps) {
  return (
    <Dialog open={expense !== null} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
        {expense && (
          <>
            <DialogHeader>
              <DialogTitle>Attachments for {expense.payee}</DialogTitle>
              <DialogDescription>
                Removing a file from an expense needs a reason, kept in the Audit Trail.
              </DialogDescription>
            </DialogHeader>
            <AttachmentsPanel owner={{ kind: "expense", id: expense.id, status: expense.status }} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
