"use client";

import { useCallback, useState } from "react";
import { MonitorSmartphone } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { portalService } from "@/services/portal.service";

/** Devices signed in to this member's account, with a way to end the others. */
export function SessionsCard() {
  const fetcher = useCallback(() => portalService.sessions(), []);
  const resource = useApiResource(fetcher);
  const [busy, setBusy] = useState<number | "others" | null>(null);

  const run = (key: number | "others", call: Promise<void>, done: string) => {
    setBusy(key);
    call
      .then(() => {
        notifySuccess(done);
        resource.refetch();
      })
      .catch((err) => notifyError(err, "That device could not be signed out."))
      .finally(() => setBusy(null));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Signed-in devices</CardTitle>
        {(resource.data?.length ?? 0) > 1 && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => run("others", portalService.logoutOthers(), "Other devices signed out")}
          >
            Sign out other devices
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          endpoints={["GET /portal/security/sessions"]}
          summary="The devices signed in to your account will show here."
          isEmpty={(rows) => rows.length === 0}
          emptyMessage="No other devices are signed in."
        >
          {(rows) => (
            <ul className="divide-y">
              {rows.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <MonitorSmartphone className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {s.device}
                      {s.current && <span className="ml-2 text-xs text-emerald-600">This device</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[s.location, s.ip_address].filter(Boolean).join(" · ")} · Active{" "}
                      {formatDateTime(s.last_active_at)}
                    </p>
                  </div>
                  {!s.current && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() => run(s.id, portalService.endSession(s.id), "Device signed out")}
                    >
                      Sign out
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}
