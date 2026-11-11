"use client";

import { useCallback, useState } from "react";
import { BranchFilter, ALL_BRANCHES, branchIdParam } from "@/components/common/branch-filter";
import { DataState } from "@/components/common/data-state";
import { portalAdminService } from "@/services/portal-admin.service";
import type { PortalStats } from "@/types/portal-admin";
import { Kpi } from "../../savings/_components/kpi";
import { usePortalResource } from "../_hooks/use-portal-resource";
import { PortalAccountsTable } from "./portal-accounts-table";

const STAT_CARDS: { key: keyof PortalStats; label: string }[] = [
  { key: "eligible", label: "Active members" },
  { key: "invited", label: "Invited, not yet activated" },
  { key: "codes_expired", label: "Invited, code expired" },
  { key: "active", label: "Using the portal" },
  { key: "active_this_month", label: "Signed in this month" },
  { key: "never_signed_in", label: "Never signed in" },
  { key: "locked", label: "Locked" },
  { key: "disabled", label: "Access turned off" },
];

/**
 * Portal Access: the counts and the members with their portal state, for the
 * caller's branches. Adapted from #511 by Augustin; bulk invitations are v2,
 * so codes are issued one member at a time from the member's page.
 */
export function PortalAccessScreen() {
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const branchId = branchIdParam(branch);
  const fetchStats = useCallback(() => portalAdminService.stats(branchId), [branchId]);
  const stats = usePortalResource(fetchStats);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portal Access</h1>
          <p className="text-sm text-muted-foreground">
            Who can use the Member Portal. Open a member to issue a code, after checking their valid ID.
          </p>
        </div>
        <BranchFilter value={branch} onChange={setBranch} className="w-56" />
      </div>
      <DataState resource={stats} endpoints={[]} summary="The Member Portal counts for your branches.">
        {(s) => (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {STAT_CARDS.map((c) => (
              <Kpi key={c.key} label={c.label} value={String(s[c.key] ?? 0)} />
            ))}
          </div>
        )}
      </DataState>
      <PortalAccountsTable branchId={branchId} />
    </div>
  );
}
