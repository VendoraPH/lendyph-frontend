"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ALL_BRANCHES, branchIdParam } from "@/components/common/branch-filter";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent } from "@/components/ui/card";
import { useApiResource, usePermission } from "@/hooks";
import { formatDateRange } from "@/lib/report-format";
import { todayDate, todayISO } from "@/lib/format";
import { savingsDashboardService } from "@/services/savings-dashboard.service";
import type { SavingsDashboard } from "@/types/savings-insight";
import { ALL_PRODUCTS, productIdParam } from "../../_lib/product-filter";
import { periodError, presetPeriod, type DashboardPeriod, type DashboardPreset } from "../_lib/dashboard-period";
import { DashboardFilters } from "./dashboard-filters";
import { GlControlNotice } from "./gl-control-notice";
import { KpiGrid } from "./kpi-grid";
import { SeriesCharts } from "./series-charts";
import { BreakdownTable } from "./breakdown-table";
import { MaturityBuckets } from "./maturity-buckets";

/** Reports one click away, for users who can open them. */
const REPORT_LINKS = [
  { href: "/reports/savings_summary", label: "Deposit Summary" },
  { href: "/reports/savings_interest_accrual", label: "Accrued interest" },
  { href: "/reports/savings_time_deposits", label: "Time deposits outstanding" },
  { href: "/reports/savings_gl_control", label: "Savings GL Control" },
];

export function SavingsDashboardScreen() {
  const { can } = usePermission();
  const [preset, setPreset] = useState<DashboardPreset>("this_month");
  const [custom, setCustom] = useState<DashboardPeriod>(() => presetPeriod("this_month", todayDate()));
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const [product, setProduct] = useState(ALL_PRODUCTS);

  const period = preset === "custom" ? custom : presetPeriod(preset, todayDate());
  const error = periodError(period, todayISO());

  const fetcher = useCallback(
    () =>
      savingsDashboardService.get({
        from: period.from,
        to: period.to,
        branch_id: branchIdParam(branch),
        product_id: productIdParam(product),
      }),
    [period.from, period.to, branch, product],
  );
  const resource = useApiResource<SavingsDashboard>(fetcher, error === null);
  const canReports = can("reports:view");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Savings Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Deposits, withdrawals, interest and time deposits for the period, from the savings records.
        </p>
      </div>

      <DashboardFilters
        preset={preset}
        onPreset={(next) => {
          if (next === "custom") setCustom(period);
          setPreset(next);
        }}
        period={period}
        onCustom={(next) => {
          setPreset("custom");
          setCustom(next);
        }}
        branch={branch}
        onBranch={setBranch}
        product={product}
        onProduct={setProduct}
      />

      {error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground" role="alert">
            {error}
          </CardContent>
        </Card>
      ) : (
        <DataState
          resource={resource}
          summary="Savings and time deposit balances, the period's movement, maturities and the check against the books."
          endpoints={["GET /savings/dashboard"]}
        >
          {(data) => (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                {formatDateRange(data.date_from, data.date_to)}
              </p>
              <GlControlNotice kpis={data.kpis} canOpenReport={canReports} />
              <KpiGrid kpis={data.kpis} />
              <SeriesCharts series={data.series} />
              <div className="grid gap-4 xl:grid-cols-2">
                <BreakdownTable title="Savings by product" groupLabel="Product" breakdown={data.by_product} />
                <BreakdownTable title="Deposits by branch" groupLabel="Branch" breakdown={data.by_branch} />
              </div>
              <MaturityBuckets buckets={data.maturity_buckets} asOf={data.date_to} />
            </div>
          )}
        </DataState>
      )}

      {canReports && (
        <nav aria-label="Savings reports">
          <p className="mb-3 text-sm font-medium text-muted-foreground">Reports</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {REPORT_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 text-sm transition-colors hover:bg-accent"
              >
                {label}
                <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
