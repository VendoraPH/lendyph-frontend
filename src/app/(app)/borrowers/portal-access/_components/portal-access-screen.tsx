"use client";

import { useCallback } from "react";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { portalAdminService } from "@/services/portal-admin.service";
import type { PortalStats } from "@/types/portal";
import { PortalAccountsTable } from "./portal-accounts-table";

const STAT_CARDS: { key: keyof PortalStats; label: string }[] = [
  { key: "eligible", label: "Eligible members" },
  { key: "activated", label: "Activated" },
  { key: "active_this_month", label: "Active this month" },
  { key: "invitations_pending", label: "Invitations pending" },
  { key: "never_logged_in", label: "Never signed in" },
  { key: "locked", label: "Locked" },
];

/** Online-access adoption: who has been invited, who signed up, who is stuck. */
export function PortalAccessScreen() {
  const fetchStats = useCallback(() => portalAdminService.stats(), []);
  const stats = useApiResource(fetchStats);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Portal Access</h1>
        <p className="text-sm text-muted-foreground">
          Invite members to the Member Portal and see who is using it.
        </p>
      </div>
      <DataState
        resource={stats}
        endpoints={["GET /portal-admin/stats", "GET /portal-admin/accounts", "POST /portal-admin/invitations/bulk"]}
        summary="Member Portal adoption figures and the list of members with their online-access status."
      >
        {(s) => (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {STAT_CARDS.map((c) => (
                <Card key={c.key}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <p className="text-2xl font-bold tabular-nums">{s[c.key]}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <PortalAccountsTable onChanged={stats.refetch} />
          </div>
        )}
      </DataState>
    </div>
  );
}
