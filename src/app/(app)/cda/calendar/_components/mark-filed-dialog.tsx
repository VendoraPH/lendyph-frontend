"use client";

import { useState } from "react";
import { useDialogOpening } from "@/hooks";
import { cdaService } from "@/services";
import { notifySuccess, notifyValidation } from "@/lib/notify";
import { todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { notifyCdaError } from "../../_lib/notify-cda";
import type { CdaRequirement } from "@/types/cda";

/** Mark a custom requirement filed, on the date it was filed (today by default, never later). */
export function MarkFiledDialog({
  requirement,
  onOpenChange,
  onSaved,
}: {
  /** The item to mark; null keeps the dialog closed. */
  requirement: CdaRequirement | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const open = requirement !== null;
  const [filedOn, setFiledOn] = useState("");
  const [busy, setBusy] = useState(false);
  if (useDialogOpening(open, requirement)) setFiledOn(todayISO());

  function submit() {
    if (!requirement) return;
    if (!filedOn) {
      notifyValidation(["Date filed"]);
      return;
    }
    setBusy(true);
    cdaService
      .updateRequirement(requirement.id, { status: "filed", filed_on: filedOn })
      .then(() => {
        notifySuccess("Marked as filed");
        onOpenChange(false);
        onSaved();
      })
      .catch((err: unknown) => notifyCdaError(err, "Could not mark the requirement filed"))
      .finally(() => setBusy(false));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Mark as filed</DialogTitle>
          <DialogDescription>{requirement?.title}: its deadline reminders stop once it is filed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cda-req-mark-filed">
            Date filed <span className="text-destructive">*</span>
          </Label>
          <Input id="cda-req-mark-filed" type="date" max={todayISO()} value={filedOn} onChange={(e) => setFiledOn(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Mark as filed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
