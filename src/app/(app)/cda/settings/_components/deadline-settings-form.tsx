"use client";

import { useCallback, useState } from "react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiResource, usePermission } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import type { CdaSettings } from "@/types/cda";
import { POSITION_LABELS } from "../../_lib/labels";
import { POSITIONS, draftToSettings, settingsToDraft, type SettingsDraft } from "../_lib/settings-forms";

function Field({ id, label, help, ...input }: { id: string; label: string; help?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} readOnly={input.disabled} {...input} />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

function SettingsEditor({ settings }: { settings: CdaSettings }) {
  const { can } = usePermission();
  const [draft, setDraft] = useState<SettingsDraft>(() => settingsToDraft(settings));
  const [busy, setBusy] = useState(false);
  const disabled = busy || !can("cda:settings");
  const set = (key: keyof Omit<SettingsDraft, "trainings">) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft({ ...draft, [key]: e.target.value });

  function save() {
    const result = draftToSettings(draft);
    if ("invalid" in result) {
      notifyValidation(result.invalid);
      return;
    }
    setBusy(true);
    cdaService
      .updateSettings(result.body)
      .then((saved) => {
        setDraft(settingsToDraft(saved));
        notifySuccess("CDA settings saved");
      })
      .catch((err: unknown) => notifyError(err, "Could not save the CDA settings"))
      .finally(() => setBusy(false));
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id="cda-annual-days"
          label="Annual reports due (days after Dec 31)"
          inputMode="numeric"
          value={draft.annual_deadline_days}
          onChange={set("annual_deadline_days")}
          disabled={disabled}
          help="Applies to periods opened after a change."
        />
        <Field
          id="cda-mediation-days"
          label="Mediation reports due (days after each half)"
          inputMode="numeric"
          value={draft.mediation_deadline_days}
          onChange={set("mediation_deadline_days")}
          disabled={disabled}
        />
        <Field
          id="cda-reminder-days"
          label="Remind this many days before"
          placeholder="30, 15, 7, 3"
          value={draft.reminder_days}
          onChange={set("reminder_days")}
          disabled={disabled}
          help="Staff are also reminded on the day and once when overdue."
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Asset size bounds (₱, total assets up to)</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="cda-micro" label="Micro" inputMode="decimal" value={draft.micro} onChange={set("micro")} disabled={disabled} />
          <Field id="cda-small" label="Small" inputMode="decimal" value={draft.small} onChange={set("small")} disabled={disabled} />
          <Field id="cda-medium" label="Medium" inputMode="decimal" value={draft.medium} onChange={set("medium")} disabled={disabled} />
        </div>
        <p className="text-xs text-muted-foreground">Above the medium bound is large.</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Mandatory trainings by position</p>
        <p className="text-xs text-muted-foreground">
          Training keys, comma-separated (lower-case letters, digits and underscores). A training meets one when its
          requirement key matches.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {POSITIONS.map((position) => (
            <Field
              key={position}
              id={`cda-trainings-${position}`}
              label={POSITION_LABELS[position]}
              placeholder="e.g. basic_coop_course"
              value={draft.trainings[position] ?? ""}
              onChange={(e) => setDraft({ ...draft, trainings: { ...draft.trainings, [position]: e.target.value } })}
              disabled={disabled}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <PermissionButton permission="cda:settings" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </PermissionButton>
      </div>
    </div>
  );
}

/** Deadline days, reminders, asset size bounds and the trainings each position needs. Reminders go to staff by permission. */
export function DeadlineSettingsForm() {
  const resource = useApiResource(useCallback(() => cdaService.getSettings(), []));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Deadlines, reminders and requirements</CardTitle>
        <CardDescription>A CDA extension for a year is recorded on the year, below.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataState resource={resource} endpoints={[`GET ${API_ENDPOINTS.CDA.SETTINGS}`]} summary="The CDA settings">
          {(settings) => <SettingsEditor settings={settings} />}
        </DataState>
      </CardContent>
    </Card>
  );
}
