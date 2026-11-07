"use client";

import { useCallback, useState } from "react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import type { CdaSettings } from "@/types/cda";
import { DEFAULT_DEADLINE_DAYS } from "../../_lib/deadline";
import type { RecordDraft } from "../../_lib/record-form";
import { parseDayList, parseList, settingsToDraft } from "../_lib/settings-forms";

function SettingsEditor({ settings }: { settings: CdaSettings }) {
  const [draft, setDraft] = useState<RecordDraft>(() => settingsToDraft(settings));
  const [busy, setBusy] = useState(false);
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, [key]: e.target.value });

  function save() {
    const days = Number(draft.deadline_days);
    if (!Number.isInteger(days) || days <= 0) {
      notifyValidation(["Deadline (days after year-end)"]);
      return;
    }
    setBusy(true);
    cdaService
      .updateSettings({
        deadline_days: days,
        reminder_days: parseDayList(draft.reminder_days),
        notify_roles: parseList(draft.notify_roles),
      })
      .then((saved) => {
        setDraft(settingsToDraft(saved));
        notifySuccess("Deadline settings saved");
      })
      .catch((err: unknown) => notifyError(err, "Could not save the deadline settings"))
      .finally(() => setBusy(false));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="cda-deadline-days">Deadline (days after year-end)</Label>
          <Input id="cda-deadline-days" type="number" min={1} value={draft.deadline_days} onChange={set("deadline_days")} />
          <p className="text-xs text-muted-foreground">CDA&apos;s default is {DEFAULT_DEADLINE_DAYS} days.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cda-reminder-days">Remind this many days before</Label>
          <Input id="cda-reminder-days" value={draft.reminder_days} onChange={set("reminder_days")} placeholder="30, 15, 7, 3" />
          <p className="text-xs text-muted-foreground">Plus a notice on the day and when overdue.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cda-notify-roles">Notify roles</Label>
          <Input id="cda-notify-roles" value={draft.notify_roles} onChange={set("notify_roles")} placeholder="admin, manager" />
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

/** The filing deadline rule and who gets reminded. */
export function DeadlineSettingsForm() {
  const resource = useApiResource(useCallback(() => cdaService.getSettings(), []));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Deadlines & reminders</CardTitle>
        <CardDescription>
          The default deadline for each year. A CDA extension is set on the year itself, not here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          endpoints={[`GET ${API_ENDPOINTS.CDA.SETTINGS}`, `PUT ${API_ENDPOINTS.CDA.SETTINGS}`]}
          summary="The deadline rule and reminder schedule"
        >
          {(settings) => <SettingsEditor settings={settings} />}
        </DataState>
      </CardContent>
    </Card>
  );
}
