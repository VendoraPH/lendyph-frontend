"use client";

import { useCallback } from "react";
import { DataState } from "@/components/common/data-state";
import { RouteGuard } from "@/components/common/route-guard";
import { useReminderTestModeContext } from "@/components/reminders/test-mode";
import { useApiResource } from "@/hooks";
import { reminderService } from "@/services";
import { SettingsForm } from "./_components/settings-form";

function ReminderSettingsContent() {
  const fetcher = useCallback(() => reminderService.getSettings(), []);
  const settings = useApiResource(fetcher);
  // The shell's test-mode banner reads the settings too; a save can change it.
  const testMode = useReminderTestModeContext();
  const refetchSettings = settings.refetch;
  const refetchTestMode = testMode.refetch;
  const onSaved = useCallback(() => {
    refetchSettings();
    refetchTestMode();
  }, [refetchSettings, refetchTestMode]);
  return (
    <DataState
      resource={settings}
      summary="Reminder settings — channels, contact hours, retries and SMS/email providers — will be editable here once the reminder service is connected."
      endpoints={["GET /reminders/settings", "PUT /reminders/settings"]}
    >
      {(data) => <SettingsForm settings={data} onSaved={onSaved} />}
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
