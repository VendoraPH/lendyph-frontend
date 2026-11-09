"use client";

import { createContext, useCallback, useContext } from "react";
import { FlaskConical } from "lucide-react";
import { useApiResource } from "@/hooks";
import { TEST_MODE_BANNER, reminderTestMode } from "@/lib/reminders";
import { cn } from "@/lib/utils";
import { reminderService } from "@/services";

export interface ReminderTestModeState {
  /** True while the deployment sends nothing; null until the settings are read. */
  testMode: boolean | null;
  /** The cooperative's own switch; null until the settings are read. */
  enabled: boolean | null;
  /** Read the settings again (after a save). */
  refetch: () => void;
}

/**
 * Reads test mode from `GET /reminders/settings`, never from a guess. While
 * the settings can't be read, `testMode` stays null and no screen claims
 * either way.
 */
export function useReminderTestMode(active = true): ReminderTestModeState {
  const fetchSettings = useCallback(() => reminderService.getSettings(), []);
  const settings = useApiResource(fetchSettings, active);
  return {
    testMode: reminderTestMode(settings.data),
    enabled: settings.data ? settings.data.enabled : null,
    refetch: settings.refetch,
  };
}

const ReminderTestModeContext = createContext<ReminderTestModeState>({
  testMode: null,
  enabled: null,
  refetch: () => {},
});

/** The reminders shell reads test mode once and hands it to every tab. */
export const ReminderTestModeProvider = ReminderTestModeContext.Provider;

export function useReminderTestModeContext(): ReminderTestModeState {
  return useContext(ReminderTestModeContext);
}

/**
 * The banner every reminders screen shows while nothing is sent. Renders
 * nothing unless the settings say test mode.
 */
export function TestModeBanner({
  testMode,
  enabled,
  className,
}: {
  testMode: boolean | null;
  enabled: boolean | null;
  className?: string;
}) {
  if (testMode !== true) return null;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-sky-300 bg-sky-50 p-4 text-sky-900 dark:border-sky-800 dark:bg-sky-500/10 dark:text-sky-200",
        className,
      )}
    >
      <FlaskConical className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="text-sm">
        <p className="font-semibold">{TEST_MODE_BANNER}</p>
        <p>
          {enabled === false
            ? "Automated reminders are switched off in Settings, and no SMS or email goes to members."
            : "No SMS or email goes to members. Messages are kept in Message History, marked Test mode."}
        </p>
      </div>
    </div>
  );
}
