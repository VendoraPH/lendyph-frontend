"use client";

import { useCallback, useState } from "react";
import { DataState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { TONE_CLASS } from "@/lib/portal/labels";
import { portalService } from "@/services/portal.service";
import { StatusPill } from "./portal-shell";

/** Recent sign-in attempts, with "This wasn't me" to flag one to the cooperative. */
export function LoginHistoryCard() {
  const fetcher = useCallback(() => portalService.logins(), []);
  const resource = useApiResource(fetcher);
  const [reporting, setReporting] = useState<number | null>(null);

  const report = (id: number) => {
    setReporting(id);
    portalService
      .reportLogin(id)
      .then(() => {
        notifySuccess("Reported to your cooperative", "Change your password now to keep your account safe.");
        resource.refetch();
      })
      .catch((err) => notifyError(err, "The sign-in could not be reported."))
      .finally(() => setReporting(null));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent sign-ins</CardTitle>
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          endpoints={["GET /portal/security/logins"]}
          summary="Your recent sign-ins will show here."
          isEmpty={(rows) => rows.length === 0}
          emptyMessage="No sign-ins recorded yet."
        >
          {(rows) => (
            <ul className="divide-y">
              {rows.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                  <StatusPill className={TONE_CLASS[l.success ? "success" : "danger"]}>
                    {l.success ? "Signed in" : "Failed"}
                  </StatusPill>
                  <span className="font-medium">{formatDateTime(l.at)}</span>
                  <span className="text-muted-foreground">
                    {[l.device, l.location, l.ip_address].filter(Boolean).join(" · ")}
                  </span>
                  <span className="ml-auto">
                    {l.reported ? (
                      <span className="text-xs text-muted-foreground">Reported</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        disabled={reporting === l.id}
                        onClick={() => report(l.id)}
                      >
                        This wasn&apos;t me
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}
