"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { RemindersShell } from "./_components/reminders-shell";

/**
 * Every reminder screen sits behind `reminders:view`. The shell's own request
 * (the active pauses) lives inside the guard, so a user without the permission
 * never asks the API for anything.
 */
export default function RemindersLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard permission="reminders:view" pageName="Reminders">
      <RemindersShell>{children}</RemindersShell>
    </RouteGuard>
  );
}
