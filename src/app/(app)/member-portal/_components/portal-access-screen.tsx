"use client";

import { useCallback } from "react";
import { BranchFilter, branchIdParam } from "@/components/common/branch-filter";
import { DataState } from "@/components/common/data-state";
import { portalAdminService } from "@/services/portal-admin.service";
import type { PortalStats } from "@/types/portal-admin";
import { Kpi } from "../../savings/_components/kpi";
import { usePortalResource } from "../_hooks/use-portal-resource";
import { PortalAccountsTable } from "./portal-accounts-table";
import { PageFill } from "@/components/common/page-fill";
import { cn } from "@/lib/utils";
import { useBranchFilter } from "@/hooks/use-working-branch";

// At fit the counts' cards drop their extra padding, so the members list
// below keeps most of the screen. Every count stays.
const COMPACT_KPIS =
  "fit:gap-2 fit:[&_[data-slot=card]]:py-2.5 fit:[&_[data-slot=card-content]]:py-0 fit:[&_[data-slot=card-content]>p+p]:mt-0";

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
  const [branch, setBranch] = useBranchFilter();
  const branchId = branchIdParam(branch);
  const fetchStats = useCallback(() => portalAdminService.stats(branchId), [branchId]);
  const stats = usePortalResource(fetchStats);

  return (
    <PageFill className="fit:gap-4">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
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
          <div className={cn("grid shrink-0 grid-cols-2 gap-3 md:grid-cols-4", COMPACT_KPIS)}>
            {STAT_CARDS.map((c) => (
              <Kpi key={c.key} label={c.label} value={String(s[c.key] ?? 0)} />
            ))}
          </div>
        )}
      </DataState>
      <PortalAccountsTable branchId={branchId} />
    </PageFill>
  );
}
