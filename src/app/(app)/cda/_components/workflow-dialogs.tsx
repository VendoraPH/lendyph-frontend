"use client";

import { useState } from "react";
import { useDialogOpening } from "@/hooks";
import { notifyValidation } from "@/lib/notify";
import { todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STAGE_LABELS, SUBMISSION_METHOD_LABELS, labelOf, toOptions } from "../_lib/labels";
import type { CdaSubmissionInput, CdaSubmissionMethod } from "@/types/cda";

interface ConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolve to close; reject to keep the dialog open. */
  onConfirm: () => Promise<void>;
}

function useRun(onOpenChange: (open: boolean) => void) {
  const [busy, setBusy] = useState(false);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    const ok = await work().then(
      () => true,
      () => false,
    );
    setBusy(false);
    if (ok) onOpenChange(false);
  }
  return { busy, run };
}

/** Finalizing with warnings open needs them confirmed (`confirm_warnings`), which the server records. */
export function FinalizeDialog({ open, onOpenChange, onConfirm, warnings }: ConfirmProps & { warnings: number }) {
  const { busy, run } = useRun(onOpenChange);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalize this report?</DialogTitle>
          <DialogDescription>
            Finalizing locks the report and keeps a fixed copy of its figures with a checksum.
            {warnings > 0 &&
              ` ${warnings} ${warnings === 1 ? "warning is" : "warnings are"} still open; finalizing confirms you have checked ${warnings === 1 ? "it" : "them"}.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => run(onConfirm)} disabled={busy}>
            {busy ? "Finalizing…" : warnings > 0 ? "Confirm warnings and finalize" : "Finalize"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const METHOD_OPTIONS = toOptions(SUBMISSION_METHOD_LABELS);

/** How and when the report was filed with CDA (`mark_submitted`). */
export function FilingDialog({
  open,
  onOpenChange,
  onConfirm,
}: Omit<ConfirmProps, "onConfirm"> & { onConfirm: (submission: CdaSubmissionInput) => Promise<void> }) {
  const [form, setForm] = useState({ method: "", submitted_on: "", submitted_by_name: "", cda_reference_no: "", acknowledgment_no: "", remarks: "" });
  const { busy, run } = useRun(onOpenChange);
  if (useDialogOpening(open, "filing")) {
    setForm({ method: "", submitted_on: todayISO(), submitted_by_name: "", cda_reference_no: "", acknowledgment_no: "", remarks: "" });
  }
  const set = (key: keyof typeof form) => (value: string) => setForm({ ...form, [key]: value });

  function submit() {
    const missing = [!form.method && "How it was filed", !form.submitted_on && "Date filed"].filter(Boolean) as string[];
    if (missing.length > 0) {
      notifyValidation(missing);
      return;
    }
    const blankToNull = (v: string) => (v.trim() === "" ? null : v.trim());
    void run(() =>
      onConfirm({
        method: form.method as CdaSubmissionMethod,
        submitted_on: form.submitted_on,
        submitted_by_name: blankToNull(form.submitted_by_name),
        cda_reference_no: blankToNull(form.cda_reference_no),
        acknowledgment_no: blankToNull(form.acknowledgment_no),
        remarks: blankToNull(form.remarks),
      }),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record filing with CDA</DialogTitle>
          <DialogDescription>The filing is linked to the finalized version. Upload the proof from Submission History.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cda-filing-method">
              How it was filed <span className="text-destructive">*</span>
            </Label>
            <NativeSelect id="cda-filing-method" value={form.method} onChange={(e) => set("method")(e.target.value)}>
              <NativeSelectOption value="">Select…</NativeSelectOption>
              {METHOD_OPTIONS.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cda-filing-date">
              Date filed <span className="text-destructive">*</span>
            </Label>
            <Input id="cda-filing-date" type="date" max={todayISO()} value={form.submitted_on} onChange={(e) => set("submitted_on")(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cda-filing-by">Filed by</Label>
            <Input id="cda-filing-by" value={form.submitted_by_name} onChange={(e) => set("submitted_by_name")(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cda-filing-ref">CDA reference number</Label>
            <Input id="cda-filing-ref" value={form.cda_reference_no} onChange={(e) => set("cda_reference_no")(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cda-filing-ack">Acknowledgment number</Label>
            <Input id="cda-filing-ack" value={form.acknowledgment_no} onChange={(e) => set("acknowledgment_no")(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cda-filing-remarks">Remarks</Label>
            <Textarea id="cda-filing-remarks" value={form.remarks} onChange={(e) => set("remarks")(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Record filing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Move financial statements or the sworn statement to another stage. */
export function StageDialog({
  open,
  onOpenChange,
  onConfirm,
  stages,
  current,
}: Omit<ConfirmProps, "onConfirm"> & { onConfirm: (stage: string) => Promise<void>; stages: string[]; current: string | null }) {
  const [stage, setStage] = useState("");
  const { busy, run } = useRun(onOpenChange);
  if (useDialogOpening(open, current)) setStage(current ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change stage</DialogTitle>
          <DialogDescription>Now: {current ? labelOf(STAGE_LABELS, current) : "not set"}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cda-stage">Stage</Label>
          <NativeSelect id="cda-stage" value={stage} onChange={(e) => setStage(e.target.value)}>
            <NativeSelectOption value="">Select…</NativeSelectOption>
            {stages.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {labelOf(STAGE_LABELS, s)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => (stage ? run(() => onConfirm(stage)) : notifyValidation(["Stage"]))} disabled={busy}>
            {busy ? "Saving…" : "Change stage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Approving one step of the review chain, with optional remarks kept on the
 * step and in the audit trail. Only the last step approves the report.
 */
export function ApproveStepDialog({
  open,
  onOpenChange,
  stepName,
  roleLabel,
  last,
  onConfirm,
}: Omit<ConfirmProps, "onConfirm"> & {
  stepName: string;
  roleLabel: string;
  last: boolean;
  onConfirm: (remarks: string | null) => Promise<void>;
}) {
  const [remarks, setRemarks] = useState("");
  const { busy, run } = useRun(onOpenChange);
  if (useDialogOpening(open, stepName)) setRemarks("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve “{stepName}”</DialogTitle>
          <DialogDescription>
            {roleLabel} review step.{" "}
            {last ? "This is the last step, so approving it approves the report." : "The report then moves on to the next step."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cda-approve-remarks">Remarks</Label>
          <Textarea
            id="cda-approve-remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="min-h-20"
            placeholder="Optional"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => run(() => onConfirm(remarks.trim() || null))} disabled={busy}>
            {busy ? "Approving…" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
