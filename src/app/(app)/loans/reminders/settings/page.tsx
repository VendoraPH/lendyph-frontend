"use client";

import { useCallback } from "react";
import { DataState } from "@/components/common/data-state";
import { RouteGuard } from "@/components/common/route-guard";
import { useApiResource } from "@/hooks";
import { reminderService } from "@/services";
import { SettingsForm } from "./_components/settings-form";

function ReminderSettingsContent() {
  const fetcher = useCallback(() => reminderService.getSettings(), []);
  const settings = useApiResource(fetcher);
  return (
    <DataState
      resource={settings}
      summary="Reminder settings — channels, contact hours, retries and SMS/email providers — will be editable here once the reminder service is connected."
      endpoints={["GET /reminders/settings", "PUT /reminders/settings"]}
    >
      {(data) => <SettingsForm settings={data} onSaved={settings.refetch} />}
    </DataState>
  );
}

/** Provider credentials live here, so this tab needs more than `reminders:view`. */
export default function ReminderSettingsPage() {
  return (
    <RouteGuard permission="reminders:settings" pageName="Reminder Settings">
      <ReminderSettingsContent />
    </RouteGuard>
  );
}
