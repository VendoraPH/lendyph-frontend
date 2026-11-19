"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { useBranches, usePermission } from "@/hooks";
import { branchFilterOptions, branchIdParam } from "@/lib/branch-filter";
import { useAuthStore } from "@/store";
import type { ExecutivePreset } from "@/types/executive-dashboard";
import { useExecutiveDashboard } from "../_hooks/use-executive-dashboard";
import { useExecutiveEndpoints } from "../_hooks/use-executive-endpoints";
import { todayISO } from "@/lib/format";
import {
  captionText,
  cardFigureText,
  cardViews,
  executiveQuery,
  isPastPeriod,
  rangeProblem,
  sentFilters,
  updatedText,
  type PeriodChoice,
} from "../_lib/executive-overview";
import { EXECUTIVE_LAYOUT as L } from "../_lib/executive-layout";
import { AttentionPanel } from "./_components/attention-panel";
import { BranchSection } from "./_components/branch-section";
import { CollectionSection } from "./_components/collection-section";
import { ExportMenu } from "./_components/export-menu";
import { FilterBar } from "./_components/filter-bar";
import { FinancialSection } from "./_components/financial-section";
import { KpiCard, KpiCardSkeleton } from "./_components/kpi-card";
import { OperationsSection } from "./_components/operations-section";
import { NO_PAGE_FILTERS, PageFilters, pageFilterIds, type PageFilterChoice } from "./_components/page-filters";
import { ParLoansDialog } from "./_components/par-loans-dialog";
import { ShareCapitalControlSection } from "./_components/share-capital-control-section";
import { TrendsSection } from "./_components/trends-section";
import { TurnaroundSection } from "./_components/turnaround-section";
import { PortfolioSection } from "./_components/portfolio-section";
import { useBranchFilter } from "@/hooks/use-working-branch";

const INITIAL_PRESET: ExecutivePreset = "this_month";
/** How many cards to hold places for while the overview loads (the server sends 14). */
const CARD_PLACES = 14;

function ExecutiveDashboard() {
  // A preset by name, or a custom range: the server works out the dates in Manila.
  // `choice` is what the controls show; `sent` is the last complete one, so a
  // custom range missing a date sends nothing and says what's missing.
  const [choice, setChoice] = useState<PeriodChoice>({ preset: INITIAL_PRESET });
  const [sent, setSent] = useState<PeriodChoice>({ preset: INITIAL_PRESET });
  const problem = rangeProblem(choice);
  const [branch, setBranch] = useBranchFilter();
  const [reloadCount, setReloadCount] = useState(0);
  const [parOpen, setParOpen] = useState(false);
  const [pageFilters, setPageFilters] = useState<PageFilterChoice>(NO_PAGE_FILTERS);

  const { branches } = useBranches();
  const user = useAuthStore((s) => s.user);
  const { can } = usePermission();
  const viewAll = can("branches:view_all");
  const mayOpenPar = can("reports:view") && can("loans:view");
  const branchOptions = branchFilterOptions(branches, user, viewAll);
  const branchLabel = branchOptions.items.find((i) => i.value === branch)?.label ?? null;

  const branchId = branchIdParam(branch);
  const filterIds = useMemo(() => pageFilterIds(pageFilters), [pageFilters]);
  const query = useMemo(() => executiveQuery(sent, branchId, filterIds), [sent, branchId, filterIds]);
  const sentFilterKeys = sentFilters(query);
  const endpoints = useExecutiveEndpoints(query, reloadCount);
  const overview = endpoints.overview.state === "ready" ? endpoints.overview.data : null;
  const branchesData = endpoints.branches.state === "ready" ? endpoints.branches.data : null;
  // The server's period, from whichever of the two answered first.
  const period = overview?.period ?? branchesData?.period ?? null;
  const refusal =
    endpoints.overview.state === "refused"
      ? endpoints.overview.message
      : endpoints.branches.state === "refused"
        ? endpoints.branches.message
        : null;
  const periodRefused = period === null ? refusal : null;
  const data = useExecutiveDashboard({ period, branchId, pageFilters: filterIds }, reloadCount, periodRefused !== null);
  // The server's today (the branch table's balances date): balances follow the cards' as-of rule.
  const pastPeriod = period !== null && isPastPeriod(period, branchesData?.balances_as_of ?? todayISO());
  const cards = overview ? cardViews(overview) : [];
  const loading =
    endpoints.overview.state === "loading" ||
    endpoints.branches.state === "loading" ||
    Object.values(data).some((s) => s.state === "loading");

  function choose(next: PeriodChoice) {
    setChoice(next);
    if (rangeProblem(next) === null) setSent(next);
  }

  function choosePreset(next: ExecutivePreset) {
    // Custom starts from the dates on screen; the server checks them.
    choose(next === "custom" ? { preset: "custom", from: period?.from, to: period?.to } : { preset: next });
  }

  function chooseRange(from: string | null, to: string | null) {
    // A start moved past the end clears the end: it is asked for, never dropped silently.
    choose({ preset: "custom", from: from ?? undefined, to: to ?? undefined });
  }

  return (
    <PageFill className="gap-4">
      <div className={`${L.pinned} flex flex-wrap items-end justify-between gap-2`}>
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" /> Dashboard
          </Link>
          <h1 className="text-xl font-semibold">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {captionText(period, periodRefused)}
            {branchLabel ? ` · ${branchLabel}` : ""}
          </p>
        </div>
      </div>

      <FilterBar
        preset={choice.preset}
        onPreset={choosePreset}
        from={choice.preset === "custom" ? (choice.from ?? "") : (period?.from ?? "")}
        to={choice.preset === "custom" ? (choice.to ?? "") : (period?.to ?? "")}
        onRange={chooseRange}
        branch={branch}
        branchItems={branchOptions.items}
        onBranch={setBranch}
        onRefresh={() => setReloadCount((n) => n + 1)}
        refreshing={loading}
        filtersSlot={<PageFilters value={pageFilters} onChange={setPageFilters} />}
        exportSlot={
          <ExportMenu
            input={
              period
                ? {
                    data,
                    overview,
                    branches: branchesData,
                    attention: endpoints.attention.state === "ready" ? endpoints.attention.data : null,
                    sentFilters: sentFilterKeys,
                    period,
                  }
                : null
            }
            branchLabel={branchLabel}
            disabled={loading}
          />
        }
      />

      {problem || periodRefused ? (
        <p role="alert" className={`${L.pinned} rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive`}>
          {problem ?? periodRefused}
        </p>
      ) : null}

      <ScrollBox className={L.scrollBox}>
        {/* Only the header and filter bar stay pinned. The sections' tables scroll sideways in their cards; nothing pins to this box. */}
        <div data-unpinned className={L.scrollBody}>
          <section aria-labelledby="exec-overview" className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="exec-overview" className="text-sm font-semibold">
                Executive Overview
              </h2>
              {overview ? <p className="text-xs text-muted-foreground">{updatedText(overview.generated_at)}</p> : null}
            </div>
            {endpoints.overview.state === "refused" ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                The cards are not available: {endpoints.overview.message}
              </p>
            ) : (
              <div className={L.kpiGrid}>
                {overview
                  ? cards.map((card) => (
                      <KpiCard key={card.key} card={card} onOpenPar={mayOpenPar ? () => setParOpen(true) : null} />
                    ))
                  : Array.from({ length: CARD_PLACES }, (_, i) => <KpiCardSkeleton key={i} />)}
              </div>
            )}
          </section>

          <div className={L.columns}>
            <div className="flex min-w-0 flex-col gap-4">
              <PortfolioSection data={data} pastPeriod={pastPeriod} />
              <CollectionSection data={data} pastPeriod={pastPeriod} />
              <FinancialSection data={data} allowance={cardFigureText(overview, "required_allowance")} />
              <TrendsSection source={endpoints.trends} sentFilters={sentFilterKeys} />
              <TurnaroundSection source={endpoints.turnaround} sentFilters={sentFilterKeys} />
              <OperationsSection data={data} />
              <BranchSection source={endpoints.branches} sentFilters={sentFilterKeys} />
              <ShareCapitalControlSection source={endpoints.shareCapitalControl} />
            </div>
            <aside className={`${L.cell} xl:sticky xl:top-0 xl:self-start`}>
              <AttentionPanel source={endpoints.attention} sentFilters={sentFilterKeys} />
            </aside>
          </div>
        </div>
      </ScrollBox>
      {mayOpenPar ? <ParLoansDialog open={parOpen} onOpenChange={setParOpen} query={query} /> : null}
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
