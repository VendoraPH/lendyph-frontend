"use client";

import { useCallback, useState } from "react";
import { BellRing, CheckCircle2, PauseCircle, PlayCircle, TriangleAlert } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { PauseDialog } from "@/components/reminders/pause-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { useApiResource, usePermission } from "@/hooks";
import { formatDate } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { reminderService } from "@/services";
import type {
  BorrowerNotificationPreferences,
  BorrowerNotificationPreferencesUpdate,
} from "@/types/reminder";

const CHANNEL_OPTIONS: { value: BorrowerNotificationPreferences["preferred_channel"]; label: string }[] = [
  { value: "both", label: "SMS and Email" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "fil", label: "Filipino" },
  { value: "ceb", label: "Cebuano" },
];

function ContactLine({ label, value, verified }: { label: string; value: string | null; verified: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        {value ?? <span className="text-muted-foreground">None on file</span>}
        {value &&
          (verified ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" aria-label="Verified" />
          ) : (
            <span className="text-xs text-muted-foreground">(unverified)</span>
          ))}
      </span>
    </div>
  );
}

function PreferencesBody({
  data,
  borrowerId,
  onChanged,
}: {
  data: BorrowerNotificationPreferences;
  borrowerId: number;
  onChanged: () => void;
}) {
  const { can } = usePermission();
  const canEdit = can("borrowers:update");
  const [saving, setSaving] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [resuming, setResuming] = useState(false);

  /** Each control saves on change; there are only four and no form to submit. */
  const update = (patch: Partial<BorrowerNotificationPreferencesUpdate>) => {
    setSaving(true);
    const { sms_enabled, email_enabled, preferred_channel, language } = data;
    reminderService
      .updateBorrowerPreferences(borrowerId, { sms_enabled, email_enabled, preferred_channel, language, ...patch })
      .then(() => {
        setSaving(false);
        notifySuccess("Notification preferences saved");
        onChanged();
      })
      .catch((err) => {
        setSaving(false);
        notifyError(err, "Could not save the preferences.");
      });
  };

  const resume = () => {
    setResuming(true);
    reminderService
      .resume({ scope: "borrower", borrower_id: borrowerId })
      .then(() => {
        setResuming(false);
        notifySuccess("Reminders resumed for this borrower");
        onChanged();
      })
      .catch((err) => {
        setResuming(false);
        notifyError(err, "Could not resume reminders.");
      });
  };

  const disabled = !canEdit || saving;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <ContactLine label="Mobile" value={data.mobile_number} verified={data.mobile_verified} />
        <ContactLine label="Email" value={data.email} verified={data.email_verified} />
        {data.invalid_contact_reason && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <TriangleAlert className="h-3.5 w-3.5" /> {data.invalid_contact_reason}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={data.sms_enabled} disabled={disabled} onCheckedChange={(sms_enabled) => update({ sms_enabled })} />
          SMS reminders
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={data.email_enabled} disabled={disabled} onCheckedChange={(email_enabled) => update({ email_enabled })} />
          Email reminders
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NativeSelect
          aria-label="Preferred channel"
          className="w-full"
          disabled={disabled}
          value={data.preferred_channel}
          onChange={(e) => update({ preferred_channel: e.target.value as BorrowerNotificationPreferences["preferred_channel"] })}
        >
          {CHANNEL_OPTIONS.map((o) => (
            <NativeSelectOption key={o.value} value={o.value}>
              {o.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Language"
          className="w-full"
          disabled={disabled}
          value={data.language}
          onChange={(e) => update({ language: e.target.value })}
        >
          {LANGUAGES.map((l) => (
            <NativeSelectOption key={l.value} value={l.value}>
              {l.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {data.pause ? (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <p>
            Reminders paused by {data.pause.paused_by_name} on {formatDate(data.pause.paused_at)} — {data.pause.reason}
          </p>
          <PermissionButton permission="reminders:pause" size="sm" variant="outline" onClick={resume} disabled={resuming}>
            <PlayCircle className="mr-1 h-3.5 w-3.5" /> {resuming ? "Resuming…" : "Resume"}
          </PermissionButton>
        </div>
      ) : (
        <PermissionButton permission="reminders:pause" size="sm" variant="outline" onClick={() => setPauseOpen(true)}>
          <PauseCircle className="mr-1 h-3.5 w-3.5" /> Pause reminders for this borrower
        </PermissionButton>
      )}

      <PauseDialog
        open={pauseOpen}
        onOpenChange={setPauseOpen}
        scope="borrower"
        borrowerId={borrowerId}
        targetLabel="this borrower"
        onPaused={onChanged}
      />
    </div>
  );
}

function NotificationPreferencesContent({ borrowerId }: { borrowerId: number }) {
  const fetcher = useCallback(() => reminderService.getBorrowerPreferences(borrowerId), [borrowerId]);
  const prefs = useApiResource(fetcher);
  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <BellRing className="h-4 w-4 text-muted-foreground" />
          Reminder Preferences
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataState
          resource={prefs}
          summary="How this borrower receives payment reminders — channels, language and pauses — will be managed here once the reminder service is connected."
          endpoints={[`GET /borrowers/${borrowerId}/notification-preferences`]}
        >
          {(data) => <PreferencesBody data={data} borrowerId={borrowerId} onChanged={prefs.refetch} />}
        </DataState>
      </CardContent>
    </Card>
  );
}

/** Renders nothing — and requests nothing — without `reminders:view`. */
export function NotificationPreferencesCard({ borrowerId }: { borrowerId: number }) {
  const { can } = usePermission();
  if (!can("reminders:view")) return null;
  return <NotificationPreferencesContent borrowerId={borrowerId} />;
}
