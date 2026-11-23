"use client";

import { useCallback, useState } from "react";
import { BranchFilter } from "@/components/common/branch-filter";
import { DataState } from "@/components/common/data-state";
import { DateRangeFilter } from "@/components/common/date-range-filter";
import { ScrollBox } from "@/components/common/page-fill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource, usePermission } from "@/hooks";
import { branchIdParam } from "@/lib/branch-filter";
import { formatDate, formatDateISO, todayDate, todayISO } from "@/lib/format";
import { loanOriginationService } from "@/services";
import { ApplicationsTable } from "./_components/applications-table";
import { KpiGrid } from "./_components/dashboard/kpi-grid";
import { OriginationCharts } from "./_components/dashboard/origination-charts";
import { TurnaroundCard } from "./_components/dashboard/turnaround-card";
import { useBranchFilter } from "@/hooks/use-working-branch";

function thirtyDaysAgo(): string {
  const d = todayDate();
  d.setDate(d.getDate() - 29);
  return formatDateISO(d);
}

/**
 * `GET /loan-origination/dashboard`: the period's figures beside the previous
 * period's, for the caller's branches. Test links are left out by the server.
 */
export default function OriginationDashboardPage() {
  const canViewLoans = usePermission().can("loans:view");
  const [range, setRange] = useState(() => ({ from: thirtyDaysAgo(), to: todayISO() }));
  const [branch, setBranch] = useBranchFilter();
  const fetcher = useCallback(
    () =>
      loanOriginationService.dashboard({
        date_from: range.from,
        date_to: range.to,
        branch_id: branchIdParam(branch),
      }),
    [range, branch],
  );
  const dashboard = useApiResource(fetcher);

  return (
    <ScrollBox className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <DateRangeFilter
          label="Period"
          from={range.from}
          to={range.to}
          onChange={(from, to) => setRange({ from: from ?? thirtyDaysAgo(), to: to ?? todayISO() })}
        />
        <BranchFilter value={branch} onChange={setBranch} />
      </div>

      <DataState
        resource={dashboard}
        summary="Application counts, amounts, processing times and conversion rates for the chosen period will show here once online applications are connected."
        endpoints={["GET /loan-origination/dashboard"]}
      >
        {(data) => (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {formatDate(data.period.from)} to {formatDate(data.period.to)}, beside the previous period,{" "}
              {formatDate(data.previous_period.from)} to {formatDate(data.previous_period.to)}. Test links are left out.
            </p>
            <KpiGrid kpis={data.kpis} previous={data.previous} canViewLoans={canViewLoans} />
            <TurnaroundCard turnaround={data.turnaround} />
            <OriginationCharts data={data} />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recent applications</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recent.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No applications in this period.</p>
                ) : (
                  <ApplicationsTable rows={data.recent} compact />
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DataState>
    </ScrollBox>
  );
}
