"use client";

import { useCallback } from "react";
import { MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { LoadState } from "@/components/portal/load-state";
import { SectionCard } from "@/components/portal/section-card";
import { formatDateTime } from "@/lib/format";
import { useConfirmedSubmit } from "@/lib/portal/hooks/use-confirmed-submit";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { portalService } from "@/lib/portal/portal-api";
import { CONFIRMS } from "@/lib/portal/server-confirm";
import { plural } from "@/lib/portal/words";

/** Where the member is signed in now, with "Sign out" per device and "Sign out other devices". */
export function SessionsCard() {
  const fetcher = useCallback(() => portalService.sessions(), []);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load your devices. Please try again.");
  const { submitting, submit } = useConfirmedSubmit();
  const others = data?.filter((s) => !s.current).length ?? 0;

  const endOne = (id: number) =>
    submit(() => portalService.endSession(id), {
      expect: CONFIRMS.done,
      success: "That device was signed out",
      failure: "We couldn't sign that device out. Please try again.",
      onConfirmed: reload,
    });

  const endOthers = () =>
    submit(() => portalService.logoutOthers(), {
      expect: CONFIRMS.done,
      success: (result) => `Signed out ${plural(result.sessions_ended, "other device")}`,
      failure: "We couldn't sign out your other devices. Please try again.",
      onConfirmed: reload,
    });

  return (
    <SectionCard
      title="Where you're signed in"
      action={
        others > 0 ? (
          <Button variant="outline" size="sm" onClick={endOthers} disabled={submitting}>
            {submitting && <Spinner className="h-4 w-4" />}
            Sign out other devices
          </Button>
        ) : undefined
      }
    >
      <LoadState loading={loading} error={error} onRetry={reload}>
        <ul className="divide-y">
          {data?.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="flex min-w-0 items-start gap-2">
                <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words">
                    {session.device}
                    {session.current && <span className="ml-2 text-xs font-normal text-emerald-700 dark:text-emerald-400">This device</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last active {formatDateTime(session.last_active_at)}
                    {session.ip_address ? ` · ${session.ip_address}` : ""}
                  </p>
                </div>
              </div>
              {!session.current && (
                <Button variant="ghost" size="sm" onClick={() => endOne(session.id)} disabled={submitting}>
                  Sign out
                  <span className="sr-only"> {session.device}</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </LoadState>
    </SectionCard>
  );
}
