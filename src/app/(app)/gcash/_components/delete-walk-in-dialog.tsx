"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { gcashService } from "@/services/gcash.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import type { GCashNonMember } from "@/types";

interface Props {
  nonMember: GCashNonMember;
  onOpenChange(open: boolean): void;
  onDeleted(nonMember: GCashNonMember): void;
}

/**
 * Confirms deleting a walk-in. The backend soft-deletes, so the transactions
 * already recorded for them keep their walk-in; only new ones can't pick them.
 */
export function DeleteWalkInDialog({
  nonMember,
  onOpenChange,
  onDeleted,
}: Props) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await gcashService.deleteNonMember(nonMember.id);
      toast.success(`${nonMember.full_name} deleted.`);
      onDeleted(nonMember);
    } catch (err) {
      toast.error(extractGCashErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog
      open
      onOpenChange={(o) => {
        if (!o && !deleting) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {nonMember.full_name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {nonMember.id_type} · {nonMember.id_number} · {nonMember.mobile_number}.
            They will no longer come up when you search for a name. Past
            transactions keep this walk-in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? "Deleting…" : "Delete walk-in"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
