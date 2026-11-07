"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiResource } from "@/hooks/use-api-resource";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { PROFILE_FIELDS, REQUEST_STATUS, TONE_CLASS } from "@/lib/portal/labels";
import { portalService } from "@/services/portal.service";
import type { ProfileUpdateRequest } from "@/types/portal";
import { StatusPill } from "./portal-shell";

/** The member's change requests and what the cooperative decided. */
export function ProfileRequestsList({ resource }: { resource: ApiResource<ProfileUpdateRequest[]> }) {
  const [cancelling, setCancelling] = useState<number | null>(null);
  const rows = resource.data ?? [];

  const cancel = (id: number) => {
    setCancelling(id);
    portalService
      .cancelProfileRequest(id)
      .then(() => {
        notifySuccess("Request withdrawn");
        resource.refetch();
      })
      .catch((err) => notifyError(err, "The request could not be withdrawn."))
      .finally(() => setCancelling(null));
  };

  // The profile is what matters on this screen; a missing requests endpoint
  // simply hides the history instead of filling the page with a second notice.
  if (resource.unavailable || (resource.loading && rows.length === 0)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Change requests</CardTitle>
      </CardHeader>
      <CardContent>
        {resource.error ? (
          <p className="text-sm text-destructive">{resource.error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have not requested any changes.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => {
              const status = REQUEST_STATUS[r.status] ?? { label: r.status, tone: "muted" as const };
              return (
                <li key={r.id} className="space-y-1.5 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.reference}</span>
                    <StatusPill className={TONE_CLASS[status.tone]}>{status.label}</StatusPill>
                    <span className="text-xs text-muted-foreground">{formatDateTime(r.submitted_at)}</span>
                    {r.status === "submitted" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-7"
                        disabled={cancelling === r.id}
                        onClick={() => cancel(r.id)}
                      >
                        Withdraw
                      </Button>
                    )}
                  </div>
                  <ul className="text-muted-foreground">
                    {r.changes.map((c) => (
                      <li key={c.field}>
                        {PROFILE_FIELDS[c.field] ?? c.field}: {c.current || "—"} →{" "}
                        <span className="text-foreground">{c.requested}</span>
                      </li>
                    ))}
                  </ul>
                  {r.response && (
                    <p className="rounded-md bg-muted p-2 text-xs">Cooperative&apos;s reply: {r.response}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
