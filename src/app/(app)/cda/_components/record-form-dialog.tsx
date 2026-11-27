"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useDialogOpening } from "@/hooks";
import { notifyValidation } from "@/lib/notify";
import { FORM_STEP_GRID } from "@/lib/form-stepper";
import {
  FormStep,
  FormStepper,
  type FormStepperHandle,
} from "@/components/common/form-stepper";
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
import {
  recordStepErrors,
  recordSteps,
  serverFieldErrors,
  type RecordStepGroup,
} from "../_lib/record-steps";
import { RecordFields } from "./record-fields";

/** A register's add or edit form (carried over from #510 by Augustin). */

export interface FileSlot {
  label: string;
  /** Needed on a new record only. */
  required?: boolean;
  accept?: string;
  /** Offered when editing too (a training's certificate, replaced by a new version). */
  onEdit?: boolean;
  /** The upload's field name, where a 422 names it (`file` when not set). Steps only. */
  key?: string;
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
  /**
   * A long form's steps, by field key in the form's order (Arvin, 2026-11-17).
   * Without them the dialog is one page, as before.
   */
  steps?: readonly RecordStepGroup[];
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
  steps,
  onSubmit,
}: RecordFormDialogProps) {
  const [draft, setDraft] = useState<RecordDraft>({});
  const [attachment, setAttachment] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(0);
  const stepperRef = useRef<FormStepperHandle>(null);
  if (useDialogOpening(open, record)) {
    setDraft(toDraft(fields, record, defaults));
    setAttachment(null);
    setOpening((n) => n + 1);
  }

  const showFile = !!file && (!record || !!file.onEdit);
  const fileKey = file?.key ?? "file";
  const fileMissing = !!file?.required && !record && !attachment;
  const stepDefs = useMemo(
    () => (steps ? recordSteps(steps, fields, showFile ? fileKey : null) : []),
    [steps, fields, showFile, fileKey],
  );

  async function submit() {
    const missing = missingFields(fields, draft);
    if (fileMissing && file) missing.push(file.label);
    if (missing.length > 0) {
      notifyValidation(missing);
      return;
    }
    setBusy(true);
    const ok = await onSubmit(fromDraft(fields, draft), attachment).then(
      () => true,
      (err: unknown) => {
        const errors = serverFieldErrors(err);
        if (errors) stepperRef.current?.showErrors(errors);
        return false;
      },
    );
    setBusy(false);
    if (ok) onOpenChange(false);
  }

  function submitSteps(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  /** The attachment's input; in steps it spans the row and carries its error key. */
  const fileInput = (stepped: boolean) =>
    showFile &&
    file && (
      <div data-field={stepped ? fileKey : undefined} className={stepped ? "col-span-full space-y-2" : "space-y-2 sm:col-span-2"}>
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
    );

  if (steps) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <form onSubmit={submitSteps} className="flex min-h-0 flex-1 flex-col">
            <FormStepper
              key={opening}
              ref={stepperRef}
              layout="dialog"
              mode={record ? "edit" : "create"}
              steps={stepDefs}
              validateStep={(id) => {
                const step = stepDefs.find((s) => s.id === id);
                const needed = fileMissing && file ? { key: fileKey, label: file.label } : null;
                return step ? recordStepErrors(step, fields, draft, needed) : true;
              }}
              submitLabel="Save"
              submittingLabel="Saving…"
              submitting={busy}
              actions={
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                  Cancel
                </Button>
              }
            >
              {stepDefs.map((step) => (
                <FormStep key={step.id} id={step.id}>
                  <div className={FORM_STEP_GRID.roomy}>
                    <RecordFields fields={fields.filter((f) => step.fields?.includes(f.key))} draft={draft} onChange={setDraft} />
                    {step.fields?.includes(fileKey) && fileInput(true)}
                  </div>
                </FormStep>
              ))}
            </FormStepper>
          </form>
        </DialogContent>
      </Dialog>
    );
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
          {fileInput(false)}
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
