"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { LoadState } from "@/components/portal/load-state";
import { SectionCard } from "@/components/portal/section-card";
import { StatusPill } from "@/components/portal/status-pill";
import { formatDateTime } from "@/lib/format";
import { useConfirmedSubmit } from "@/lib/portal/hooks/use-confirmed-submit";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { LOGIN_OUTCOME, LOGIN_OUTCOME_TONE, NONE } from "@/lib/portal/labels";
import { portalService } from "@/lib/portal/portal-api";
import { CONFIRMS } from "@/lib/portal/server-confirm";
import type { PortalLoginEvent } from "@/lib/portal/types";

/**
 * The last 20 sign-in attempts. "This wasn't me" reports one: the server
 * signs out every other device, tells the branch, and asks for a new password.
 */
export function LoginHistoryCard({ onReported }: { onReported: () => void }) {
  const fetcher = useCallback(() => portalService.logins(), []);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load your sign-ins. Please try again.");
  const { submitting, submit } = useConfirmedSubmit();
  const [reporting, setReporting] = useState<PortalLoginEvent | null>(null);

  const report = () => {
    if (!reporting) return;
    submit(() => portalService.reportLogin(reporting.id), {
      expect: CONFIRMS.done,
      success: "Reported. Your other devices were signed out. Please change your password now.",
      failure: "We couldn't report that sign-in. Please try again.",
      onConfirmed: (result) => {
        setReporting(null);
        reload();
        if (result.password_change_required) onReported();
      },
    });
  };

  return (
    <SectionCard title="Recent sign-ins">
      <LoadState loading={loading} error={error} onRetry={reload} empty={data?.length === 0} emptyText="No sign-ins yet.">
        <ul className="divide-y">
          {data?.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <StatusPill value={event.outcome} labels={LOGIN_OUTCOME} tones={LOGIN_OUTCOME_TONE} />
                  <span className="break-words">{event.device ?? NONE}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(event.created_at)}
                  {event.ip_address ? ` · ${event.ip_address}` : ""}
                  {event.reported_at ? " · Reported" : ""}
                </p>
              </div>
              {!event.reported_at && (
                <Button variant="ghost" size="sm" onClick={() => setReporting(event)}>
                  This wasn&apos;t me
                </Button>
              )}
            </li>
          ))}
        </ul>
      </LoadState>
      <Dialog open={reporting !== null} onOpenChange={(open) => !open && !submitting && setReporting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this sign-in?</DialogTitle>
            <DialogDescription>
              We&apos;ll sign out every other device and let your branch know. Then please choose a new password.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReporting(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={report} disabled={submitting}>
              {submitting && <Spinner className="h-4 w-4" />}
              Report it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
