"use client";

import { useCallback, useState } from "react";
import { Building2 } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { useAccountingResource, usePermission } from "@/hooks";
import { todayISO } from "@/lib/format";
import { accountingService } from "@/services";
import type { AllowancePreview } from "@/types";
import { AccountingPageHeader } from "../_components/page-header";
import { DataState } from "../_components/data-state";
import { DateFilter, FilterBar } from "../_components/accounting-filters";
import { AllowanceHistory } from "./_components/allowance-history";
import { AllowanceSummary } from "./_components/allowance-summary";
import { BranchAllowanceCard } from "./_components/branch-allowance-card";
import { PostAllowancePanel } from "./_components/post-allowance-panel";
import { CONFLICT_MESSAGE, accessNotice, branchViews } from "./_lib/allowance";

const DESCRIPTION =
  "What each branch should hold against overdue principal, and the adjustment that gets it there.";

function AllowanceContent() {
  const { can } = usePermission();
  const canViewAllBranches = can("branches:view_all");
  const notice = accessNotice(canViewAllBranches);

  const [asOf, setAsOf] = useState(todayISO());
  const [conflict, setConflict] = useState(false);
  const [postings, setPostings] = useState(0);

  // Every allowance route answers 403 without access to every branch, so don't ask.
  const fetcher = useCallback(() => accountingService.allowancePreview(asOf), [asOf]);
  const preview = useAccountingResource<AllowancePreview>(fetcher, canViewAllBranches);

  const changeDate = (next: string) => {
    setConflict(false);
    setAsOf(next);
  };

  const posted = () => {
    setConflict(false);
    setPostings((n) => n + 1);
    preview.refetch();
  };

  const figuresChanged = () => {
    setConflict(true);
    preview.refetch();
  };

  return (
    <div className="space-y-6">
      <AccountingPageHeader title="Allowance for Credit Losses" description={DESCRIPTION} />

      {notice ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Building2 className="h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="max-w-lg text-sm text-muted-foreground">{notice}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <FilterBar>
            <DateFilter label="As of" value={asOf} onChange={changeDate} />
          </FilterBar>

          {conflict && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
            >
              {CONFLICT_MESSAGE}
            </div>
          )}

          <DataState
            resource={preview}
            summary="The required allowance by branch and aging bucket, each branch's current balance, and the adjustment to post."
            endpoints={["GET /accounting/allowance/preview", "POST /accounting/allowance/postings"]}
          >
            {(data) => (
              <div className="space-y-6">
                <Card>
                  <CardContent className="space-y-6 pt-6">
                    <AllowanceSummary preview={data} />
                    <PostAllowancePanel
                      preview={data}
                      onPosted={posted}
                      onConflict={figuresChanged}
                    />
                  </CardContent>
                </Card>
                {branchViews(data).map((branch) => (
                  <BranchAllowanceCard key={branch.id} branch={branch} />
                ))}
              </div>
            )}
          </DataState>

          <AllowanceHistory key={postings} />
        </>
      )}
    </div>
  );
}

export default function AllowancePage() {
  return (
    <RouteGuard permission="accounting:view" pageName="Allowance for Credit Losses">
      <AllowanceContent />
    </RouteGuard>
  );
}
