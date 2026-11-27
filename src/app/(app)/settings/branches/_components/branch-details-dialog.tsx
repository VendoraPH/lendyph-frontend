"use client";

import { useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataState } from "@/components/common/data-state";
import { useApiResource } from "@/hooks/use-api-resource";
import { branchFigureRows, type BranchPageFeatures } from "@/lib/branch-page";
import type { BranchClosureInfo } from "@/lib/branch-closure";
import { formatDate } from "@/lib/format";
import { branchService, type ApiBranch } from "@/services/branch.service";
import { BranchClosurePanel } from "./branch-closure-panel";
import { BranchStatusBadge } from "./branch-status-badge";
import { MainOfficeAction, MainOfficeBadge } from "./main-office-action";

interface BranchDetailsDialogProps {
  branch: ApiBranch | null;
  onOpenChange: (open: boolean) => void;
  features: BranchPageFeatures;
  onChanged: () => void;
}

/** A branch's profile, server figures, main office and closure (multi-branch flag). */
export function BranchDetailsDialog({ branch, onOpenChange, features, onChanged }: BranchDetailsDialogProps) {
  return (
    <Dialog open={branch !== null} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {branch && <DetailsBody key={branch.id} branchId={branch.id} features={features} onChanged={onChanged} />}
      </DialogContent>
    </Dialog>
  );
}

function DetailsBody({ branchId, features, onChanged }: { branchId: number; features: BranchPageFeatures; onChanged: () => void }) {
  const fetcher = useCallback(() => branchService.detail(branchId), [branchId]);
  const resource = useApiResource<ApiBranch>(fetcher);
  // Read here, not in the panel, so Make main office knows a closure waits.
  const closureFetcher = useCallback(() => branchService.closure(branchId), [branchId]);
  const closure = useApiResource<BranchClosureInfo>(closureFetcher, features.closure);
  const closureWaiting = closure.data?.request?.status === "pending";
  const titleRef = useRef<HTMLHeadingElement>(null);

  function changed() {
    resource.refetch();
    closure.refetch();
    onChanged();
  }

  const loaded = resource.data;
  return (
    <>
      <DialogHeader>
        <DialogTitle ref={titleRef} tabIndex={-1} className="flex flex-wrap items-center gap-2 outline-none">
          {loaded?.name ?? "Branch details"}
          {loaded && <BranchStatusBadge branch={loaded} />}
          {loaded?.is_main_office && <MainOfficeBadge />}
        </DialogTitle>
        <DialogDescription>Profile, figures and status of this branch.</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 space-y-6 overflow-y-auto pr-1">
        <DataState resource={resource} endpoints={["GET /branches/{id}"]} summary="Branch details show here once the server provides them.">
          {(branch) => (
            <div className="space-y-6">
              <Profile branch={branch} />
              {features.figures && branch.figures && <Figures branch={branch} />}
              {features.mainOffice && (
                <div>
                  <MainOfficeAction
                    branch={branch}
                    onChanged={changed}
                    closureWaiting={closureWaiting}
                    fallbackFocus={titleRef}
                  />
                </div>
              )}
              {features.closure && <BranchClosurePanel branch={branch} resource={closure} onChanged={changed} fallbackFocus={titleRef} />}
            </div>
          )}
        </DataState>
      </div>
    </>
  );
}

function Profile({ branch }: { branch: ApiBranch }) {
  const rows: Array<[string, string]> = [
    ["Code", branch.code],
    ["Address", branch.address || "—"],
    ["Contact Number", branch.contact_number || "—"],
    ["Email", branch.email || "—"],
    ["Branch Manager", branch.manager?.full_name ?? "—"],
    ["Opening Date", branch.opened_on ? formatDate(branch.opened_on) : "—"],
    ...(branch.closed_on ? [["Closing Date", formatDate(branch.closed_on)] as [string, string]] : []),
    ["Assigned users", branch.users_count === undefined ? "—" : String(branch.users_count)],
    ["CDA Authority Number (to verify)", branch.cda_authority_number || "—"],
    ["CDA Authority Date Issued (to verify)", branch.cda_authority_issued_on ? formatDate(branch.cda_authority_issued_on) : "—"],
  ];
  return (
    <section aria-label="Profile">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Figures({ branch }: { branch: ApiBranch }) {
  return (
    <section aria-labelledby={`branch-${branch.id}-figures`} className="space-y-2">
      <h3 id={`branch-${branch.id}-figures`} className="text-sm font-semibold">
        Lending figures
      </h3>
      <dl className="grid gap-3 sm:grid-cols-3">
        {branchFigureRows(branch.figures ?? {}).map(({ label, value }) => (
          <div key={label} className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
