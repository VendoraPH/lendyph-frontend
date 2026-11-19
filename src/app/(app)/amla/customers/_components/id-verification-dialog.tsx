"use client";

import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useApiResource, usePermission } from "@/hooks";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { amlaCddAccess, type AmlaSubjectRef } from "@/lib/amla/cdd-access";
import { amlaCddApi } from "@/lib/amla/cdd-api";
import {
  AMLA_ID_METHOD_OPTIONS,
  AMLA_ID_RESULT_OPTIONS,
  amlaIdDocumentOptions,
  amlaIdVerificationBody,
  type AmlaIdVerificationForm,
} from "@/lib/amla/cdd-view";
import type { AmlaOption } from "@/lib/amla/settings-view";
import { notifyError, notifySuccess } from "@/lib/notify";
import { CddFormDialog } from "./cdd-form-dialog";

const EMPTY: AmlaIdVerificationForm = { documentId: "", method: "", result: "", expiresOn: "", notes: "" };

interface Props {
  open: boolean;
  subject: AmlaSubjectRef;
  onClose: () => void;
  onRecorded: () => void;
}

/**
 * Record a person's check of an ID already on record: one of the member's own
 * valid IDs, or the walk-in's ID. Only its type and last four are kept.
 */
export function IdVerificationDialog({ open, subject, onClose, onRecorded }: Props) {
  const { can } = usePermission();
  const member = subject.type === "member";
  const canList = amlaCddAccess(can).memberIds;
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();
  const fetcher = useCallback(() => amlaCddApi.memberIdDocuments(subject.id), [subject.id]);
  const documents = useApiResource(fetcher, open && member && canList);
  const choices = documents.data ? amlaIdDocumentOptions(documents.data) : [];

  if (useDialogOpening(open, subject)) {
    setForm(EMPTY);
    setError(null);
  }

  const set = (key: keyof AmlaIdVerificationForm) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  function submit() {
    const result = amlaIdVerificationBody(subject.type, form);
    if ("error" in result) return setError(result.error);
    run(() => amlaCddApi.verifyId(subject, result.body))
      ?.then(() => {
        notifySuccess("ID check recorded");
        onRecorded();
      })
      .catch((err: unknown) => notifyError(err, "The ID check couldn't be recorded."));
  }

  const pick = (key: keyof AmlaIdVerificationForm, label: string, options: readonly AmlaOption[], empty: string) => (
    <div className="space-y-1">
      <Label htmlFor={`cdd-id-${key}`}>{label}</Label>
      <NativeSelect id={`cdd-id-${key}`} className="w-full" value={form[key]} disabled={submitting} onChange={(e) => set(key)(e.target.value)}>
        <NativeSelectOption value="">{empty}</NativeSelectOption>
        {options.map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <CddFormDialog
      open={open}
      title="Record an ID check"
      description="Record what you checked. A photocopy or scan alone never verifies an ID, and nothing here calls an outside provider."
      submitLabel="Record"
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      {member && <MemberIdPicker canList={canList} loading={documents.loading} failed={documents.error !== null || documents.unavailable} choices={choices} pick={pick} />}
      {!member && <p className="text-sm text-muted-foreground">The walk-in&apos;s ID on record is checked.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {pick("method", "How it was checked", AMLA_ID_METHOD_OPTIONS, "Pick a method")}
        {pick("result", "Result", AMLA_ID_RESULT_OPTIONS, "Pick a result")}
        <div className="space-y-1">
          <Label htmlFor="cdd-id-expires">Expires on (optional)</Label>
          <Input id="cdd-id-expires" type="date" value={form.expiresOn} disabled={submitting} onChange={(e) => set("expiresOn")(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="cdd-id-notes">Notes (optional)</Label>
        <Textarea id="cdd-id-notes" value={form.notes} maxLength={2000} disabled={submitting} onChange={(e) => set("notes")(e.target.value)} />
      </div>
    </CddFormDialog>
  );
}

interface PickerProps {
  canList: boolean;
  loading: boolean;
  failed: boolean;
  choices: AmlaOption[];
  pick: (key: keyof AmlaIdVerificationForm, label: string, options: readonly AmlaOption[], empty: string) => React.ReactNode;
}

function MemberIdPicker({ canList, loading, failed, choices, pick }: PickerProps) {
  if (!canList) {
    return <p className="text-sm text-muted-foreground">Picking the member&apos;s ID needs access to member records.</p>;
  }
  if (loading) return <p className="text-sm text-muted-foreground">Loading the member&apos;s IDs…</p>;
  if (failed) return <p className="text-sm text-destructive">The member&apos;s IDs couldn&apos;t be loaded.</p>;
  if (choices.length === 0) {
    return <p className="text-sm text-muted-foreground">This member has no valid ID with its number on file. Add one on the member&apos;s page first.</p>;
  }
  return pick("documentId", "The member's valid ID", choices, "Pick an ID");
}
