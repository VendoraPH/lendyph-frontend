"use client";

import { notFound } from "next/navigation";
import { RouteGuard } from "@/components/common/route-guard";
import { env } from "@/config/env";
import { RemindersShell } from "./_components/reminders-shell";

/**
 * Every reminder screen sits behind `reminders:view`. The shell's own requests
 * (the active pauses, and the settings for test mode) live inside the guard,
 * so a user without the permission never asks the API for anything.
 *
 * On unless a deployment sets NEXT_PUBLIC_ENABLE_LOAN_REMINDERS=false at build
 * time; then every reminder screen answers not found.
 */
export default function RemindersLayout({ children }: { children: React.ReactNode }) {
  if (!env.features.loanReminders) notFound();
  return (
    <RouteGuard permission="reminders:view" pageName="Reminders">
      <RemindersShell>{children}</RemindersShell>
    </RouteGuard>
  );
}
