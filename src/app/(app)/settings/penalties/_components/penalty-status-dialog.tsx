"use client";

import { Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { PenaltyConfig } from "@/types/penalty";

interface PenaltyStatusDialogProps {
  config: PenaltyConfig | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** "Deactivate …?" / "Activate …?" — switching changes what overdue borrowers are charged next. */
export function PenaltyStatusDialog({ config, busy, onCancel, onConfirm }: PenaltyStatusDialogProps) {
  const deactivating = config?.status === "active";
  return (
    <AlertDialog open={config !== null} onOpenChange={(open) => !open && !busy && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{deactivating ? "Deactivate" : "Activate"} {config?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {deactivating
              ? "Its loan products stop using these conditions for penalties charged from now on and fall back to their own penalty rate. Penalties already charged are not changed."
              : "Its loan products use these conditions for penalties charged from now on."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {deactivating ? "Deactivate" : "Activate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
