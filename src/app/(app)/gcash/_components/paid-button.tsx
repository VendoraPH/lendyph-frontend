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
import { Button } from "@/components/ui/button";
import { gcashService } from "@/services/gcash.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";

interface Props {
  transactionId: number;
  referenceNo: string;
  onPaid?(): void;
}

export function PaidButton({ transactionId, referenceNo, onPaid }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    setSubmitting(true);
    try {
      await gcashService.markPaid(transactionId);
      toast.success(`Marked ${referenceNo} as paid.`);
      onPaid?.();
      setOpen(false);
    } catch (err) {
      toast.error(extractGCashErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Paid
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark as paid?</AlertDialogTitle>
          <AlertDialogDescription>
            Confirm the member has paid the cash for transaction{" "}
            <span className="font-mono">{referenceNo}</span>. This finalizes the
            income for this row.
          </AlertDialogDescription>
        </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirm} disabled={submitting}>
              {submitting ? "Saving…" : "Confirm Paid"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
