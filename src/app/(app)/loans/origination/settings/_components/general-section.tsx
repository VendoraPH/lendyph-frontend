"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useBranches } from "@/hooks";
import type { OriginationSettings } from "@/types/loan-origination";
import { NumberField, SettingsCard, ToggleField } from "./fields";

type General = OriginationSettings["general"];
type Notifications = OriginationSettings["notifications"];

export function GeneralSection({ value, onChange }: { value: General; onChange: (next: General) => void }) {
  const { branches } = useBranches();
  const set = (patch: Partial<General>) => onChange({ ...value, ...patch });
  return (
    <SettingsCard title="Online applications" description="Whether the public links accept applications, and how drafts behave.">
      <ToggleField
        label="Accept online applications"
        hint="When off, every application link shows a closed notice. Drafts already started are kept."
        checked={value.online_applications_enabled}
        onChange={(online_applications_enabled) => set({ online_applications_enabled })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="default-branch">Default branch</Label>
          <NativeSelect
            id="default-branch"
            className="w-full"
            value={value.default_branch_id ?? ""}
            onChange={(e) => set({ default_branch_id: e.target.value ? Number(e.target.value) : null })}
          >
            <NativeSelectOption value="">Head office</NativeSelectOption>
            {branches.map((b) => (
              <NativeSelectOption key={b.id} value={b.id}>
                {b.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">Used when a link names no branch.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reference-format">Reference format</Label>
          <Input
            id="reference-format"
            value={value.reference_format}
            onChange={(e) => set({ reference_format: e.target.value })}
            placeholder="APP-{YYYY}-{SEQ:6}"
          />
          <p className="text-xs text-muted-foreground">Given to an application when it is submitted.</p>
        </div>
        <NumberField
          label="Delete unsubmitted drafts after"
          suffix="days"
          min={1}
          value={value.draft_expiration_days}
          onChange={(v) => set({ draft_expiration_days: v ?? 0 })}
        />
        <NumberField
          label="Time to complete, shown to applicants"
          suffix="minutes"
          nullable
          hint="Leave empty to hide it."
          value={value.estimated_minutes}
          onChange={(estimated_minutes) => set({ estimated_minutes })}
        />
      </div>
    </SettingsCard>
  );
}

const NOTICES: { key: Exclude<keyof Notifications, "incomplete_reminder_after_days">; label: string; hint: string }[] = [
  { key: "application_confirmation", label: "Confirmation", hint: "Sent with the reference number when an application is submitted." },
  { key: "incomplete_reminder", label: "Unfinished application reminder", hint: "Sent once to applicants who stopped part way." },
  { key: "document_request", label: "Document requests", hint: "Sent when staff ask for a document or more information." },
  { key: "status_change", label: "Progress updates", hint: "Sent when the application moves to a new stage." },
  { key: "decision", label: "Decision", hint: "Sent when the application is approved or declined." },
];

export function NotificationsSection({ value, onChange }: { value: Notifications; onChange: (next: Notifications) => void }) {
  const set = (patch: Partial<Notifications>) => onChange({ ...value, ...patch });
  return (
    <SettingsCard title="Applicant messages" description="Text messages and emails sent to the applicant's verified mobile and email.">
      {NOTICES.map((n) => (
        <ToggleField key={n.key} label={n.label} hint={n.hint} checked={value[n.key]} onChange={(on) => set({ [n.key]: on })} />
      ))}
      {value.incomplete_reminder && (
        <NumberField
          label="Send the reminder after"
          suffix="days without progress"
          min={1}
          value={value.incomplete_reminder_after_days}
          onChange={(v) => set({ incomplete_reminder_after_days: v ?? 1 })}
        />
      )}
    </SettingsCard>
  );
}
