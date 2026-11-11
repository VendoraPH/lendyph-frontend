"use client";

import { useState } from "react";
import { useDialogOpening } from "@/hooks";
import { notifyValidation } from "@/lib/notify";
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
import {
  fromDraft,
  missingFields,
  toDraft,
  type RecordDraft,
  type RecordField,
  type RecordValues,
} from "../_lib/record-form";
import { RecordFields } from "./record-fields";

/** A register's add or edit form (carried over from #510 by Augustin). */

export interface FileSlot {
  label: string;
  /** Needed on a new record only. */
  required?: boolean;
  accept?: string;
  /** Offered when editing too (a training's certificate, replaced by a new version). */
  onEdit?: boolean;
}

/** What the CDA upload rules take: pictures, PDFs, Word documents and Excel workbooks, up to 10 MB. */
export const CDA_FILE_ACCEPT = "application/pdf,image/jpeg,image/png,.doc,.docx,.xls,.xlsx";

interface RecordFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: RecordField[];
  /** The record being edited; null or undefined for a new one. */
  record?: object | null;
  /** A new record's starting values. */
  defaults?: RecordDraft;
  /** An attachment (certificate, proof, document file). Offered only when set. */
  file?: FileSlot;
  /** Resolve to close; reject to keep the dialog and its input. */
  onSubmit: (values: RecordValues, file: File | null) => Promise<unknown>;
}

export function RecordFormDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  record,
  defaults,
  file,
  onSubmit,
}: RecordFormDialogProps) {
  const [draft, setDraft] = useState<RecordDraft>({});
  const [attachment, setAttachment] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  if (useDialogOpening(open, record)) {
    setDraft(toDraft(fields, record, defaults));
    setAttachment(null);
  }

  async function submit() {
    const missing = missingFields(fields, draft);
    if (file?.required && !record && !attachment) missing.push(file.label);
    if (missing.length > 0) {
      notifyValidation(missing);
      return;
    }
    setBusy(true);
    const ok = await onSubmit(fromDraft(fields, draft), attachment).then(
      () => true,
      () => false,
    );
    setBusy(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <RecordFields fields={fields} draft={draft} onChange={setDraft} />
          {file && (!record || file.onEdit) && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rec-file">
                {file.label} {file.required && !record && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="rec-file"
                type="file"
                accept={file.accept}
                onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
