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
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/api-error";
import { notifySuccess } from "@/lib/notify";
import { accountingService } from "@/services";
import type { YearClose } from "@/types";
import {
  REOPEN_REASON_MAX,
  reopenConfirmText,
  reopenReason,
  reopenReasonError,
} from "../_lib/year-close";

interface ReopenYearDialogProps {
  /** The close to reopen; the dialog is open while it is set. */
  row: YearClose | null;
  onClose: () => void;
  onReopened: () => void;
}

/** Mounted per row (keyed by its id), so each opening starts with an empty reason. */
function ReopenForm({ row, onClose, onReopened }: { row: YearClose } & Omit<ReopenYearDialogProps, "row">) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const reasonError = reopenReasonError(reason);
  const showError = touched && reasonError !== null;

  const submit = async () => {
    setTouched(true);
    if (reasonError !== null) return;
    setBusy(true);
    setRefusal(null);
    try {
      await accountingService.reopenYear(row.id, reopenReason(reason));
      setBusy(false);
      notifySuccess(`${row.year} reopened.`, "Its closing entries are reversed and its months reopened.");
      onReopened();
    } catch (err) {
      setBusy(false);
      setRefusal(getErrorMessage(err, `Could not reopen ${row.year}.`));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reopen {row.year}?</DialogTitle>
        <DialogDescription>{reopenConfirmText(row)}</DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="reopen-year-reason">Reason</Label>
        <Textarea
          id="reopen-year-reason"
          value={reason}
          maxLength={REOPEN_REASON_MAX}
          required
          aria-invalid={showError}
          aria-describedby={showError ? "reopen-year-reason-error" : undefined}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="What has to be corrected in the year"
        />
        {showError && (
          <p id="reopen-year-reason-error" className="text-sm text-destructive">
            {reasonError}
          </p>
        )}
      </div>
      {refusal && (
        <p role="alert" className="text-sm text-destructive">
          {refusal}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="destructive" disabled={busy} onClick={submit}>
          {busy ? "Reopening…" : `Reopen ${row.year}`}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ReopenYearDialog({ row, onClose, onReopened }: ReopenYearDialogProps) {
  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {row && <ReopenForm key={row.id} row={row} onClose={onClose} onReopened={onReopened} />}
      </DialogContent>
    </Dialog>
  );
}
