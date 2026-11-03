"use client";

import { useState } from "react";
import { useDialogOpening } from "@/hooks";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notifySuccess } from "@/lib/notify";
import { savingsAccountService } from "@/services/savings-account.service";
import type { SavingsAccount } from "@/types/savings";
import { ConfirmActionDialog } from "../../../_components/confirm-action-dialog";
import { STATUS_ACTION, type StatusAction } from "../../../_lib/account-status";

interface StatusChangeDialogProps {
  account: SavingsAccount;
  /** Freeze, unfreeze or reactivate; closing has its own dialog. */
  action: Exclude<StatusAction, "close"> | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/** Changes the account's status. A reason is required and kept in its history. */
export function StatusChangeDialog({ account, action, onOpenChange, onDone }: StatusChangeDialogProps) {
  const open = action !== null;
  const [reason, setReason] = useState("");
  if (useDialogOpening(open, action)) setReason("");
  const meta = action ? STATUS_ACTION[action] : null;

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={meta ? `${meta.label} ${account.account_number}?` : ""}
      description={meta?.description ?? ""}
      confirmLabel={meta?.label ?? "Confirm"}
      destructive={action === "freeze"}
      errorFallback="The status could not be changed."
      confirmDisabled={!reason.trim()}
      onConfirm={async () => {
        if (!meta) return;
        await savingsAccountService.setStatus(account.id, meta.to, reason.trim());
        notifySuccess(`${meta.label}: done`, account.account_number);
        onDone();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="status-reason">
          Reason <span className="text-destructive">*</span>
        </Label>
        <Textarea id="status-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </ConfirmActionDialog>
  );
}
