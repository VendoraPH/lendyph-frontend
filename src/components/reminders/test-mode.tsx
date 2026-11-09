"use client";

import { createContext, useCallback, useContext } from "react";
import { CircleHelp, FlaskConical } from "lucide-react";
import { useApiResource } from "@/hooks";
import { TEST_MODE_BANNER, reminderTestMode, type SendMode } from "@/lib/reminders";
import { cn } from "@/lib/utils";
import { reminderService } from "@/services";

export interface ReminderTestModeState {
  /** The settings' `test_mode`: true test, false live, null not known. */
  testMode: SendMode;
  /** The cooperative's own switch; null until the settings are read. */
  enabled: boolean | null;
  /** The settings call finished without an answer (failed, or not connected). */
  unreadable: boolean;
  /** Read the settings again (after a save). */
  refetch: () => void;
}

/**
 * Reads test mode from `GET /reminders/settings`, never from a guess. While
 * the settings can't be read, `testMode` stays null and the screens use
 * neutral words, neither "Sent" nor "Logged".
 */
export function useReminderTestMode(active = true): ReminderTestModeState {
  const fetchSettings = useCallback(() => reminderService.getSettings(), []);
  const settings = useApiResource(fetchSettings, active);
  return {
    testMode: reminderTestMode(settings.data),
    enabled: settings.data ? settings.data.enabled : null,
    unreadable: !settings.data && (settings.error !== null || settings.unavailable),
    refetch: settings.refetch,
  };
}

const ReminderTestModeContext = createContext<ReminderTestModeState>({
  testMode: null,
  enabled: null,
  unreadable: false,
  refetch: () => {},
});

/** The reminders shell reads test mode once and hands it to every tab. */
export const ReminderTestModeProvider = ReminderTestModeContext.Provider;

export function useReminderTestModeContext(): ReminderTestModeState {
  return useContext(ReminderTestModeContext);
}

/**
 * The banner every reminders screen shows while nothing is sent: only on the
 * server's `test_mode: true`. When the sending status couldn't be read it
 * says so in one small line instead.
 */
export function TestModeBanner({
  testMode,
  enabled,
  unreadable = false,
  className,
}: {
  testMode: SendMode;
  enabled: boolean | null;
  unreadable?: boolean;
  className?: string;
}) {
  if (testMode === null && unreadable) {
    return (
      <p role="status" className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
        Couldn&apos;t read sending status
      </p>
    );
  }
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
