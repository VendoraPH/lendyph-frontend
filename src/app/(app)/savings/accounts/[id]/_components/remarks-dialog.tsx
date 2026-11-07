"use client";

import { useState } from "react";
import { useDialogOpening } from "@/hooks";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notifySuccess } from "@/lib/notify";
import { savingsAccountService } from "@/services/savings-account.service";
import type { SavingsAccount } from "@/types/savings";
import { ConfirmActionDialog } from "../../../_components/confirm-action-dialog";

interface RemarksDialogProps {
  account: SavingsAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/** Edits the account's remarks, the only free field; balances and status never change here. */
export function RemarksDialog({ account, open, onOpenChange, onDone }: RemarksDialogProps) {
  const [remarks, setRemarks] = useState("");
  if (useDialogOpening(open, account)) setRemarks(account.remarks ?? "");

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit remarks"
      description={`Notes on ${account.account_number}. The change is kept in the audit trail.`}
      confirmLabel="Save"
      errorFallback="The remarks could not be saved."
      onConfirm={async () => {
        await savingsAccountService.update(account.id, { remarks: remarks.trim() || null });
        notifySuccess("Remarks saved");
        onDone();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="account-remarks">Remarks</Label>
        <Textarea id="account-remarks" rows={4} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </div>
    </ConfirmActionDialog>
  );
}
