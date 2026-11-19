"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { amlaScreeningApi } from "@/lib/amla/screening-api";
import { amlaReleaseBody } from "@/lib/amla/screening-view";
import { notifyError, notifySuccess } from "@/lib/notify";

interface Props {
  open: boolean;
  orderId: number;
  onClose: () => void;
  onRequested: () => void;
}

/** Ask for an order's release. Nothing is lifted until a different sanctions holder approves it. */
export function ReleaseRequestDialog({ open, orderId, onClose, onRequested }: Props) {
  const [form, setForm] = useState({ reason: "", reference: "" });
  const [error, setError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();

  if (useDialogOpening(open, orderId)) {
    setForm({ reason: "", reference: "" });
    setError(null);
  }

  function ask() {
    const result = amlaReleaseBody(form);
    if ("error" in result) return setError(result.error);
    run(() => amlaScreeningApi.requestRelease(orderId, result.body))
      ?.then(() => {
        notifySuccess("Release asked for", "A different sanctions holder approves or rejects it.");
        onRequested();
      })
      .catch((err: unknown) => notifyError(err, "The release couldn't be asked for."));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask to release this order</DialogTitle>
          <DialogDescription>
            Give the order or resolution that lifts it. The holds stay in place until a different sanctions holder approves.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="release-reference">Lifting order or resolution reference</Label>
            <Input
              id="release-reference"
              value={form.reference}
              maxLength={150}
              disabled={submitting}
              onChange={(e) => {
                setForm({ ...form, reference: e.target.value });
                setError(null);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="release-reason">Reason</Label>
            <Textarea
              id="release-reason"
              value={form.reason}
              maxLength={2000}
              disabled={submitting}
              onChange={(e) => {
                setForm({ ...form, reason: e.target.value });
                setError(null);
              }}
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={ask} disabled={submitting}>
            {submitting && <Spinner className="mr-2 h-4 w-4" />}
            Ask for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
