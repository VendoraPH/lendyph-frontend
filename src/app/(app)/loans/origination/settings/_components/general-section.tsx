"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useBranches } from "@/hooks";
import { formatDateTime } from "@/lib/format";
import type { OriginationSettings, StaffRef } from "@/types/loan-origination";
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
      <ToggleField
        label="Release a loan only to an approved member"
        hint="On by default. Any loan, online or not, is released only once its member's registration is approved, so the pending member an online application creates is approved first."
        checked={value.require_approved_member}
        onChange={(require_approved_member) => set({ require_approved_member })}
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
            <NativeSelectOption value="">No default branch</NativeSelectOption>
            {branches.map((b) => (
              <NativeSelectOption key={b.id} value={b.id}>
                {b.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">Used when neither the link nor the applicant names a branch.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reference-format">Reference format</Label>
          <Input
            id="reference-format"
            value={value.reference_format}
            onChange={(e) => set({ reference_format: e.target.value })}
            placeholder="OA-YYYY-NNNNNN"
          />
          <p className="text-xs text-muted-foreground">
            2 to 5 capital letters, then -YYYY-NNNNNN. Given to an application when it is submitted.
          </p>
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

/** What the server reports about itself: read-only, set on the server. */
export function ServerSection({
  server,
  rulesVersion,
  updatedBy,
  updatedAt,
}: {
  server: OriginationSettings["server"];
  rulesVersion: number;
  updatedBy: StaffRef | null;
  updatedAt: string | null;
}) {
  const rows: [string, string][] = [
    ["Online applications on the server", server.enabled ? "On" : "Off"],
    ["Public address for links", server.public_url ?? server.public_url_problem ?? "Not set up"],
    ["Uploaded PDFs", server.pdf_check],
    ["Virus scanning", server.scanner],
    ["Assessment rules", `Revision ${rulesVersion}`],
  ];
  return (
    <SettingsCard title="On the server" description="Set by an administrator on the server, not here.">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map(([label, text]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="break-words">{text}</dd>
          </div>
        ))}
      </dl>
      {updatedAt && (
        <p className="text-xs text-muted-foreground">
          Last saved {formatDateTime(updatedAt)}
          {updatedBy && <> by {updatedBy.name}</>}
        </p>
      )}
    </SettingsCard>
  );
}

const NOTICES: { key: Exclude<keyof Notifications, "incomplete_reminder_after_days">; label: string; hint: string }[] = [
  { key: "application_confirmation", label: "Confirmation", hint: "With the reference number when an application is submitted." },
  { key: "incomplete_reminder", label: "Unfinished application reminder", hint: "Once, to applicants who stopped part way." },
  { key: "document_request", label: "Document requests", hint: "When staff ask for a document or more information." },
  { key: "status_change", label: "Progress updates", hint: "When the application moves to a new stage." },
  { key: "decision", label: "Decision", hint: "When the application is approved or declined." },
];

export function NotificationsSection({ value, onChange }: { value: Notifications; onChange: (next: Notifications) => void }) {
  const set = (patch: Partial<Notifications>) => onChange({ ...value, ...patch });
  return (
    <SettingsCard
      title="Applicant messages"
      description="Which messages the applicant gets. Text messages and email aren't switched on yet: messages are logged, not sent, and the applicant sees them when they track the application."
    >
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
