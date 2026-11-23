"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import type { AmlaSubjectRef } from "@/lib/amla/cdd-access";
import { amlaCddApi } from "@/lib/amla/cdd-api";
import { AMLA_PEP_STATUS_OPTIONS, AMLA_SOURCE_OF_FUNDS_OPTIONS, amlaProfileBody, amlaProfileDraft, type AmlaProfileDraft } from "@/lib/amla/cdd-view";
import type { AmlaOption } from "@/lib/amla/settings-view";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import type { AmlaCddProfile } from "@/types/amla-cdd";
import { CddFormDialog } from "./cdd-form-dialog";

interface Props {
  open: boolean;
  profile: AmlaCddProfile;
  subject: AmlaSubjectRef;
  onClose: () => void;
  onSaved: () => void;
}

/** Edit the KYC answers. Only changed answers are sent; a change to a risk factor makes the server reassess the risk. */
export function ProfileEditDialog({ open, profile, subject, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<AmlaProfileDraft>(() => amlaProfileDraft(profile));
  const [error, setError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();

  if (useDialogOpening(open, profile)) {
    setDraft(amlaProfileDraft(profile));
    setError(null);
  }

  const set = (key: keyof AmlaProfileDraft) => (value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  function save() {
    const result = amlaProfileBody(profile, draft);
    if ("error" in result) return setError(result.error);
    if ("unchanged" in result) {
      notifyInfo(result.unchanged);
      return onClose();
    }
    run(() => amlaCddApi.update(subject, result.body))
      ?.then(() => {
        notifySuccess("Answers saved");
        onSaved();
      })
      .catch((err: unknown) => notifyError(err, "The answers couldn't be saved."));
  }

  const text = (key: keyof AmlaProfileDraft, label: string, extra: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={`cdd-${key}`}>{label}</Label>
      <Input id={`cdd-${key}`} value={draft[key]} disabled={submitting} onChange={(e) => set(key)(e.target.value)} {...extra} />
    </div>
  );
  const pick = (key: keyof AmlaProfileDraft, label: string, options: readonly AmlaOption[]) => (
    <div className="space-y-1">
      <Label htmlFor={`cdd-${key}`}>{label}</Label>
      <NativeSelect id={`cdd-${key}`} className="w-full" value={draft[key]} disabled={submitting} onChange={(e) => set(key)(e.target.value)}>
        <NativeSelectOption value="">Not answered</NativeSelectOption>
        {options.map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
  const note = (key: keyof AmlaProfileDraft, label: string) => (
    <div className="space-y-1 sm:col-span-2">
      <Label htmlFor={`cdd-${key}`}>{label}</Label>
      <Textarea id={`cdd-${key}`} value={draft[key]} maxLength={2000} disabled={submitting} onChange={(e) => set(key)(e.target.value)} />
    </div>
  );

  return (
    <CddFormDialog
      open={open}
      title={profile.exists ? "Edit due diligence answers" : "Start the due diligence profile"}
      description="Answers stay on the AMLA profile, never on the member record. Each change keeps its old and new values, and the AMLA log names the fields only."
      submitLabel="Save"
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={save}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {text("nationality", "Nationality (two-letter country code)", { maxLength: 2, placeholder: "PH", className: "uppercase" })}
        {text("occupation", "Occupation or business", { maxLength: 150 })}
        {pick("source_of_funds", "Source of funds", AMLA_SOURCE_OF_FUNDS_OPTIONS)}
        {draft.source_of_funds === "other" && text("source_of_funds_other", "Other source of funds", { maxLength: 150 })}
        <div className="sm:col-span-2">{text("purpose", "Purpose of the relationship", { maxLength: 255 })}</div>
        {text("expected_monthly_amount", "Expected monthly amount, in pesos", { inputMode: "decimal", placeholder: "15000.00" })}
        {text("expected_monthly_count", "Expected transactions a month", { inputMode: "numeric" })}
        {pick("pep_status", "Politically exposed person", AMLA_PEP_STATUS_OPTIONS)}
        {pick("adverse_info", "Adverse information to verify", [
          { value: "no", label: "No" },
          { value: "yes", label: "Yes" },
        ])}
        {note("pep_details", "PEP details")}
        {note("adverse_info_note", "Adverse information note")}
      </div>
    </CddFormDialog>
  );
}
