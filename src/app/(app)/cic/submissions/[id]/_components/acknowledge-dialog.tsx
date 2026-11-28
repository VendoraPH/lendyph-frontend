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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks";
import type { CicAcknowledgementData } from "@/types/cic";

const BLANK: CicAcknowledgementData = { status: "accepted", notes: "", cic_reference_no: "" };

/** Records CIC's answer to a submitted file: accepted, or rejected with its reasons. */
export function AcknowledgeDialog({
  open,
  onOpenChange,
  busy,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onSave: (data: CicAcknowledgementData) => Promise<boolean>;
}) {
  const [form, setForm] = useState<CicAcknowledgementData>(BLANK);
  if (useDialogOpening(open, BLANK)) setForm(BLANK);
  const needsNotes = form.status === "rejected" && !form.notes?.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record CIC&apos;s Answer</DialogTitle>
          <DialogDescription>From CIC&apos;s acknowledgement of the uploaded file.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cic-ack-status">CIC&apos;s answer</Label>
            <NativeSelect
              id="cic-ack-status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value === "rejected" ? "rejected" : "accepted" })}
            >
              <NativeSelectOption value="accepted">Accepted</NativeSelectOption>
              <NativeSelectOption value="rejected">Rejected</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cic-ack-reference">CIC reference number (optional)</Label>
            <Input
              id="cic-ack-reference"
              autoComplete="off"
              maxLength={60}
              value={form.cic_reference_no ?? ""}
              onChange={(e) => setForm({ ...form, cic_reference_no: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">The reference CIC gave the file, if its answer has one.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cic-ack-notes">
              {form.status === "rejected" ? "Why CIC rejected it" : "Notes (optional)"}
            </Label>
            <Textarea
              id="cic-ack-notes"
              maxLength={2000}
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={busy || needsNotes}
            onClick={async () => {
              const saved = await onSave({
                status: form.status,
                notes: form.notes?.trim() || undefined,
                cic_reference_no: form.cic_reference_no?.trim() || undefined,
              });
              if (saved) onOpenChange(false);
            }}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
