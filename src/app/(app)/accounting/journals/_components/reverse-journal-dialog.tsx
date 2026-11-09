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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { todayISO } from "@/lib/format";
import { runJournalAction } from "../_lib/journal-refusal";

interface ReverseJournalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Writes the reversing entry. A rejection keeps the dialog open with the server's message. */
  onConfirm: (date: string, reason: string) => Promise<void>;
  /** A 409 or 422 refusal: the journal may have changed, so reload it. */
  onRefused: () => void;
}

/** The server's limit on a reversal reason (ReverseJournalRequest). */
const REASON_MAX = 300;

export function ReverseJournalDialog({
  open,
  onOpenChange,
  onConfirm,
  onRefused,
}: ReverseJournalDialogProps) {
  const [date, setDate] = useState(todayISO);
  const [reason, setReason] = useState("");
  const [reversing, setReversing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = (next: boolean) => {
    if (reversing) return;
    if (!next) {
      setDate(todayISO());
      setReason("");
      setError(null);
    }
    onOpenChange(next);
  };

  const ready = date !== "" && reason.trim() !== "";

  const confirm = () => {
    if (!ready) return;
    setReversing(true);
    setError(null);
    const trimmed = reason.trim();
    runJournalAction(() => onConfirm(date, trimmed), onRefused, "Could not reverse this entry.").then(
      (message) => {
        setError(message);
        setReversing(false);
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reverse this entry</DialogTitle>
          <DialogDescription>
            This writes and posts a second entry that mirrors this one. The original stays in the
            books and stays visible.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reverse-date">Reversal date</Label>
            <Input
              id="reverse-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reverse-reason">Why is this being reversed?</Label>
            <Textarea
              id="reverse-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Duplicate entry, wrong account, …"
              maxLength={REASON_MAX}
              rows={3}
              aria-required="true"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => change(false)} disabled={reversing}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!ready || reversing}>
            {reversing ? "Reversing…" : "Reverse entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
