"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { useBranches, usePermission } from "@/hooks";
import { ALL_BRANCHES, branchFilterOptions, branchIdParam } from "@/lib/branch-filter";
import { formatDateRange } from "@/lib/report-format";
import { todayISO } from "@/lib/format";
import { useAuthStore } from "@/store";
import { useExecutiveDashboard } from "../_hooks/use-executive-dashboard";
import { overviewKpis } from "../_lib/executive-data";
import { isValidPeriod, presetPeriod, type DashboardPreset, type Period } from "../_lib/periods";
import { AttentionPanel } from "./_components/attention-panel";
import { BranchSection } from "./_components/branch-section";
import { CollectionSection } from "./_components/collection-section";
import { ExportMenu } from "./_components/export-menu";
import { FilterBar } from "./_components/filter-bar";
import { FinancialSection } from "./_components/financial-section";
import { KpiCard } from "./_components/kpi-card";
import { OperationsSection } from "./_components/operations-section";
import { PortfolioSection } from "./_components/portfolio-section";

const INITIAL_PRESET: DashboardPreset = "this_month";

function ExecutiveDashboard() {
  const [preset, setPreset] = useState<DashboardPreset>(INITIAL_PRESET);
  const [period, setPeriod] = useState<Period>(() => presetPeriod(INITIAL_PRESET, { from: todayISO(), to: todayISO() }));
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const [reloadCount, setReloadCount] = useState(0);

  const { branches } = useBranches();
  const user = useAuthStore((s) => s.user);
  const viewAll = usePermission().can("branches:view_all");
  const branchOptions = branchFilterOptions(branches, user, viewAll);
  const branchLabel = branchOptions.items.find((i) => i.value === branch)?.label ?? null;

  const data = useExecutiveDashboard({ period, branchId: branchIdParam(branch) }, reloadCount);
  const kpis = overviewKpis(data);
  const loading = Object.values(data).some((s) => s.state === "loading");

  function choosePreset(next: DashboardPreset) {
    setPreset(next);
    if (next !== "custom") setPeriod((current) => presetPeriod(next, current));
  }

  function chooseRange(from: string | null, to: string | null) {
    if (!from || !to) return;
    const next = { from, to };
    if (!isValidPeriod(next)) return;
    setPreset("custom");
    setPeriod(next);
  }

  return (
    <PageFill className="gap-4">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-2">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" /> Dashboard
          </Link>
          <h1 className="text-xl font-semibold">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateRange(period.from, period.to)}
            {branchLabel ? ` · ${branchLabel}` : ""}
          </p>
        </div>
      </div>

      <FilterBar
        preset={preset}
        onPreset={choosePreset}
        from={period.from}
        to={period.to}
        onRange={chooseRange}
        branch={branch}
        branchItems={branchOptions.items}
        onBranch={setBranch}
        onRefresh={() => setReloadCount((n) => n + 1)}
        refreshing={loading}
        exportSlot={<ExportMenu data={data} period={period} branchLabel={branchLabel} disabled={loading} />}
      />

      <section aria-labelledby="exec-overview" className="shrink-0 space-y-2">
        <h2 id="exec-overview" className="text-sm font-semibold">
          Executive Overview
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {kpis.map((k) => (
            <KpiCard key={k.id} kpi={k} periodTo={period.to} />
          ))}
        </div>
      </section>

      <ScrollBox>
        {/* The sections' own tables scroll sideways in their cards; nothing pins to this box. */}
        <div data-unpinned className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <PortfolioSection data={data} />
            <CollectionSection data={data} />
            <FinancialSection data={data} />
            <OperationsSection data={data} />
            <BranchSection data={data} />
          </div>
          <aside className="xl:sticky xl:top-0 xl:self-start">
            <AttentionPanel data={data} />
          </aside>
        </div>
      </ScrollBox>
    </PageFill>
  );
}

export default function ExecutiveDashboardPage() {
  return (
    <RouteGuard permission="dashboard:view" pageName="Executive Dashboard">
      <ExecutiveDashboard />
    </RouteGuard>
  );
}
