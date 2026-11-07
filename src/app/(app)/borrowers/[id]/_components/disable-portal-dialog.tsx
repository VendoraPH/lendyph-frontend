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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { DISABLE_REASONS } from "@/lib/portal/labels";
import type { PortalDisableReason } from "@/types/portal";

interface DisablePortalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onConfirm: (reason: PortalDisableReason) => void;
}

/** Disabling online access always records why, for the audit log. */
export function DisablePortalDialog({ open, onOpenChange, busy, onConfirm }: DisablePortalDialogProps) {
  const [reason, setReason] = useState<PortalDisableReason>("member_request");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable online access?</DialogTitle>
          <DialogDescription>
            The member is signed out everywhere and cannot sign in until access is enabled again. Their records are
            not affected.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="disable-reason">Reason</Label>
          <NativeSelect
            id="disable-reason"
            className="w-full"
            value={reason}
            onChange={(e) => setReason(e.target.value as PortalDisableReason)}
          >
            {(Object.keys(DISABLE_REASONS) as PortalDisableReason[]).map((r) => (
              <NativeSelectOption key={r} value={r}>
                {DISABLE_REASONS[r]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => onConfirm(reason)}>
            Disable access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
