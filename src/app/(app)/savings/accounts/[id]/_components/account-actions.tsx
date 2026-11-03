"use client";

import { useState } from "react";
import { usePermission } from "@/hooks";
import { Button } from "@/components/ui/button";
import type { SavingsAccount } from "@/types/savings";
import { STATUS_ACTION, allowedStatusActions, type StatusAction } from "../../../_lib/account-status";
import { CloseAccountDialog } from "./close-account-dialog";
import { RemarksDialog } from "./remarks-dialog";
import { StatusChangeDialog } from "./status-change-dialog";

type Open = "remarks" | StatusAction | null;

/**
 * Maintenance for `savings:update`: edit remarks, and the status changes the
 * account's current status allows (freeze, unfreeze, reactivate, close).
 */
export function AccountActions({ account, onChanged }: { account: SavingsAccount; onChanged: () => void }) {
  const canUpdate = usePermission().can("savings:update");
  const [open, setOpen] = useState<Open>(null);
  if (!canUpdate || account.status === "closed") return null;

  const close = () => setOpen(null);
  const done = () => {
    setOpen(null);
    onChanged();
  };
  const statusAction = open && open !== "remarks" && open !== "close" ? open : null;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen("remarks")}>
        Edit remarks
      </Button>
      {allowedStatusActions(account.status).map((a) => (
        <Button
          key={a}
          variant="outline"
          className={a === "close" || a === "freeze" ? "text-destructive" : undefined}
          onClick={() => setOpen(a)}
        >
          {STATUS_ACTION[a].label}
        </Button>
      ))}

      <RemarksDialog account={account} open={open === "remarks"} onOpenChange={(v) => !v && close()} onDone={done} />
      <StatusChangeDialog account={account} action={statusAction} onOpenChange={(v) => !v && close()} onDone={done} />
      <CloseAccountDialog account={account} open={open === "close"} onOpenChange={(v) => !v && close()} onDone={done} />
    </>
  );
}
