"use client";

import { useCallback, useState } from "react";
import { BellRing, PauseCircle, PlayCircle } from "lucide-react";
import { PermissionGate } from "@/components/common/permission-gate";
import { PauseDialog } from "@/components/reminders/pause-dialog";
import { Button } from "@/components/ui/button";
import { useApiResource } from "@/hooks";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { reminderService } from "@/services";
import { RemindersNav } from "./reminders-nav";

/**
 * Header, global pause state and tabs shared by every reminder screen.
 *
 * The pause lives here rather than on the dashboard so the banner follows the
 * user onto every tab: a paused system that only says so on one screen is how
 * someone spends an afternoon wondering why the queue isn't moving.
 */
export function RemindersShell({ children }: { children: React.ReactNode }) {
  const fetchPauses = useCallback(() => reminderService.listPauses(), []);
  const pauses = useApiResource(fetchPauses);
  const globalPause = pauses.data?.find((p) => p.scope === "global") ?? null;
  const [pauseOpen, setPauseOpen] = useState(false);
  const [resuming, setResuming] = useState(false);

  const resume = () => {
    setResuming(true);
    reminderService
      .resume({ scope: "global" })
      .then(() => {
        setResuming(false);
        notifySuccess("Reminders resumed");
        pauses.refetch();
      })
      .catch((err) => {
        setResuming(false);
        notifyError(err, "Could not resume reminders.");
      });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BellRing className="h-6 w-6 text-brand-orange" />
            Reminders
          </h1>
          <p className="text-sm text-muted-foreground">
            Automated SMS and email reminders for upcoming and past-due installments.
          </p>
        </div>
        {/* Only offered once the pause list has loaded, so the button never
            claims "not paused" about a state it could not read. */}
        {pauses.data && !globalPause && (
          <PermissionGate permission="reminders:pause">
            <Button variant="outline" onClick={() => setPauseOpen(true)}>
              <PauseCircle className="mr-1.5 h-4 w-4" />
              Pause all reminders
            </Button>
          </PermissionGate>
        )}
      </div>

      {globalPause && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <div className="text-sm">
            <p className="font-semibold">Automated reminders are paused</p>
            <p>
              Paused by {globalPause.paused_by_name} on {formatDateTime(globalPause.paused_at)}
              {globalPause.until ? `, until ${formatDateTime(globalPause.until)}` : ""} — {globalPause.reason}
            </p>
          </div>
          <PermissionGate permission="reminders:pause">
            <Button size="sm" onClick={resume} disabled={resuming}>
              <PlayCircle className="mr-1.5 h-4 w-4" />
              {resuming ? "Resuming…" : "Resume"}
            </Button>
          </PermissionGate>
        </div>
      )}

      <RemindersNav />

      {children}

      <PauseDialog
        open={pauseOpen}
        onOpenChange={setPauseOpen}
        scope="global"
        onPaused={pauses.refetch}
      />
    </div>
  );
}
