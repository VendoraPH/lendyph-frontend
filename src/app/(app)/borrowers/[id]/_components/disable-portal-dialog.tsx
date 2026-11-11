"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useDialogOpening } from "@/hooks";
import type { PortalStaffDisableReason } from "@/types/portal-admin";
import { OptionSelect } from "@/app/(app)/savings/_components/option-select";
import { STAFF_DISABLE_REASON_LABELS, optionsOf } from "@/app/(app)/member-portal/_lib/labels";

const REASON_OPTIONS = optionsOf(STAFF_DISABLE_REASON_LABELS);

interface DisablePortalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onConfirm: (reason: PortalStaffDisableReason) => void;
}

/**
 * Turning a member's portal access off always records why. The server signs
 * them out everywhere and ends their open requests, releasing any held money.
 * Carried over from #511 by Augustin, with the server's reasons and words.
 */
export function DisablePortalDialog({ open, onOpenChange, busy, onConfirm }: DisablePortalDialogProps) {
  const [reason, setReason] = useState("");
  if (useDialogOpening(open, null)) setReason("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Turn off portal access?</DialogTitle>
          <DialogDescription>
            The member is signed out of every device and can&apos;t sign in until access is turned back on. Their
            open requests are cancelled, and money held for a withdrawal request is released. Their records don&apos;t
            change.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="portal-disable-reason">Reason</Label>
          <OptionSelect
            id="portal-disable-reason"
            value={reason}
            onChange={setReason}
            options={REASON_OPTIONS}
            placeholder="Choose the reason"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy || reason === ""}
            onClick={() => onConfirm(reason as PortalStaffDisableReason)}
          >
            Turn off access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
