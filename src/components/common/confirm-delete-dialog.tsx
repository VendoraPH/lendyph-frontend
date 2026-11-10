"use client";

import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDeleteDialogProps {
  open: boolean;
  title: string;
  /** Names what will go, e.g. "Payslip.pdf will be removed from this loan's documents." */
  description: string | null;
  /** While the delete runs: both buttons are disabled and the dialog stays open. */
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * "Delete this …?" in the app's own AlertDialog. Cancel does nothing; Delete
 * runs `onConfirm`, and the caller closes the dialog when it's done.
 *
 * Imported by path, not from components/common/index (that index isn't
 * tree-shaken).
 */
export function ConfirmDeleteDialog({ open, title, description, busy, onCancel, onConfirm }: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={onConfirm}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
