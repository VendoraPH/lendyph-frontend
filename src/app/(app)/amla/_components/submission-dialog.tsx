"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { amlaCaseApi } from "@/lib/amla/case-api";
import { AMLA_FILING_STEP_WORDS, amlaSubmissionBody, type AmlaSubmissionForm } from "@/lib/amla/case-view";
import { DOCUMENT_ACCEPT } from "@/lib/file-validation";
import { todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { AmlaFilingStepStatus, AmlaReportDetail } from "@/types/amla-cases";
import { CddFormDialog } from "../customers/_components/cdd-form-dialog";

interface Props {
  open: boolean;
  report: AmlaReportDetail;
  /** The steps the server would take next, in its order. */
  steps: readonly AmlaFilingStepStatus[];
  onClose: () => void;
  onRecorded: (report: AmlaReportDetail) => void;
}

const EMPTY: AmlaSubmissionForm = { status: "", reference: "", date: "", note: "", evidence: null };

/**
 * Record one filing step done by hand on the AMLC portal: submitted, then
 * accepted, rejected or correction required, each with the portal's
 * reference, its date and the acknowledgement or response as evidence.
 */
export function SubmissionDialog({ open, report, steps, onClose, onRecorded }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, report.status)) {
    setForm({ ...EMPTY, status: steps.length === 1 ? steps[0] : "", date: todayISO() });
    setError(null);
  }
  const set = (next: Partial<AmlaSubmissionForm>) => {
    setForm({ ...form, ...next });
    setError(null);
  };

  return (
    <CddFormDialog
      open={open}
      title="Record a filing step"
      description="Lendy doesn't file with the AMLC: file on the AMLC portal, then record here what the portal answered."
      submitLabel="Record"
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={() => {
        const result = amlaSubmissionBody(form, steps, todayISO());
        if ("error" in result) return setError(result.error);
        run(() => amlaCaseApi.recordSubmission(report.id, result.body))
          ?.then((next) => {
            notifySuccess("Filing step recorded");
            onRecorded(next);
          })
          .catch((err: unknown) => notifyError(err, "The filing step couldn't be recorded."));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="amla-step-status">Step</Label>
          <NativeSelect id="amla-step-status" className="w-full" value={form.status} disabled={submitting} onChange={(e) => set({ status: e.target.value })}>
            <NativeSelectOption value="">Pick a step</NativeSelectOption>
            {steps.map((step) => (
              <NativeSelectOption key={step} value={step}>
                {AMLA_FILING_STEP_WORDS[step]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="amla-step-date">Date</Label>
          <Input id="amla-step-date" type="date" max={todayISO()} value={form.date} disabled={submitting} onChange={(e) => set({ date: e.target.value })} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="amla-step-reference">AMLC portal reference</Label>
          <Input id="amla-step-reference" value={form.reference} maxLength={100} disabled={submitting} onChange={(e) => set({ reference: e.target.value })} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="amla-step-evidence">Evidence (the acknowledgement or response)</Label>
          <Input id="amla-step-evidence" type="file" accept={DOCUMENT_ACCEPT} disabled={submitting} onChange={(e) => set({ evidence: e.target.files?.[0] ?? null })} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="amla-step-note">Note (optional)</Label>
        <Textarea id="amla-step-note" value={form.note} maxLength={2000} disabled={submitting} onChange={(e) => set({ note: e.target.value })} />
      </div>
    </CddFormDialog>
  );
}
