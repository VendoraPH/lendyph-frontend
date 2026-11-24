// src/app/(app)/borrowers/registrations/[id]/_components/possible-duplicate-dialog.tsx
"use client";

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

interface Props {
  /** The question, or null while closed. */
  text: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Asks the reviewer to confirm before approving a possible duplicate. */
export function PossibleDuplicateDialog({ text, onCancel, onConfirm }: Props) {
  return (
    <AlertDialog
      open={text !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve a possible duplicate?</AlertDialogTitle>
          <AlertDialogDescription>{text}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Approve anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
