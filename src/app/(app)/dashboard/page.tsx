"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/common";
import { ExpandableCard } from "@/components/common/expandable-card";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FIT_CLASSES } from "@/lib/page-fill";
import { NoBranchBanner } from "@/components/common/no-branch-banner";
import { useIsClient, usePermission } from "@/hooks";
import { AreaChart, Area } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { Icon3D } from "@/components/common/icon-3d";
import { cn } from "@/lib/utils";
import { env } from "@/config/env";
import { formatCurrency, formatDateFull } from "@/lib/format";
import { shareCapitalService } from "@/services";
import { dashboardService } from "@/services/dashboard.service";
import type { DailyDuesSummary } from "@/types";
import { shareCapitalBookBalance } from "./_lib/share-capital-kpi";
import {
  collectionBadge,
  collectionPieSlices,
  isNothingDue,
  shownCollectionRate,
  todaySummaryRows,
} from "./_lib/collection-pie";
import { showExecutiveLink } from "./_lib/executive-access";
import { DuesDonut } from "./_components/dues-donut";
import { DuesTable, TransactionsTable, type DueItemView, type LoadState } from "./_components/dashboard-tables";
import { dueItemViews, type DailyDueItem } from "./_lib/daily-dues";
import {
  DASHBOARD_PAGE_CLASS,
  DUES_TABLE_PANEL_CLASS,
  DUES_TABS_LIST_CLASS,
  KPI_ICONS_3D,
  TRANSACTIONS_TABLE_PANEL_CLASS,
  dashboardKpiClasses,
} from "./_lib/kpi-layout";
import { insuranceCollected } from "./_lib/insurance-collected";
import { recentTransactionRows, type RecentTransactionRow } from "./_lib/recent-transactions";
import {
  hasSparklineData,
  isIsolatedPoint,
  sparklinePoints,
  type SparklinePoint,
} from "./_lib/sparkline";

// ---------------------------------------------------------------------------
// Backend response shapes
// ---------------------------------------------------------------------------
// Wire defensively (the API is tolerant about field names), but NEVER
// substitute invented data when a response is empty or fails — an empty
// dashboard must read as empty. See the empty/loading states below.

/** Sparkline series returned by GET /dashboard/stats. Keys mirror KPI_CARD_STRUCTURE. */
type SparklineKey = "portfolio" | "active_loans" | "collected" | "overdue";

interface DashboardStats {
  total_portfolio?: number;
  active_loans?: number;
  /** Collected over the period, the insurance premium left out. */
  total_collected?: number;
  /** The insurance premium collected over the same period, on its own. */
  insurance_collected?: number | string | null;
  overdue_count?: number;
  share_capital_total?: number;
  sparklines?: Partial<Record<SparklineKey, SparklinePoint[]>>;
}


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// KPI Card structure (values and sparklines populated from state)
// ---------------------------------------------------------------------------
// `sparkKey` is the series name in stats.sparklines. Share Capital has no
// series from the backend, so its card renders no sparkline rather than a
// decorative one.

const KPI_CARD_STRUCTURE = [
  { key: "portfolio" as const, sparkKey: "portfolio" as const, label: "Total Portfolio", color: "#7c3aed", href: "/loans" },
  { key: "active_loans" as const, sparkKey: "active_loans" as const, label: "Active Loans", color: "#e879f9", href: "/loans" },
  { key: "collected" as const, sparkKey: "collected" as const, label: "Collected", color: "#10b981", href: "/payments" },
  // `/collections` is not a route — it never existed, so this card 404'd on
  // click and on Next's prefetch. `/loans/past-due` is the purpose-built Past
  // Due Loans report, which is exactly what this card counts.
  { key: "overdue" as const, sparkKey: "overdue" as const, label: "Overdue", color: "#f87171", href: "/loans/past-due" },
  { key: "share_capital" as const, sparkKey: null, label: "Share Capital", color: "#14b8a6", href: "/share-capital/ledger" },
];

// ---------------------------------------------------------------------------
// Sparkline component
// ---------------------------------------------------------------------------

function Sparkline({ data, color }: { data: SparklinePoint[]; color: string }) {
  const gradId = `spark-${color.replace("#", "")}`;
  return (
    <AreaChart width={80} height={40} data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.4} />
          <stop offset="95%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area
        type="monotone"
        dataKey="v"
        stroke={color}
        strokeWidth={1.5}
        fill={`url(#${gradId})`}
        // A day without a figure (`v: null`) is a gap, never bridged or zeroed.
        // A real point with a gap on both sides has no segment, so it gets a
        // dot; every other point draws none.
        dot={({ cx, cy, index, key }) =>
          isIsolatedPoint(data, index) && cx != null && cy != null ? (
            <circle key={key} cx={cx} cy={cy} r={1.5} fill={color} />
          ) : null
        }
        connectNulls={false}
        isAnimationActive={false}
      />
    </AreaChart>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

// KPI tiles abbreviate on purpose ("₱130K"); below ₱1,000 there is nothing to
// abbreviate, so the figure is shown in full, to the centavo.
function formatCompactCurrency(amount: number): string {
  if (amount >= 1_000_000) return `₱${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₱${(amount / 1_000).toFixed(0)}K`;
  return formatCurrency(amount);
}

function DashboardContent() {
  const mounted = useIsClient();
  const kpiClasses = dashboardKpiClasses();
  const canViewShareCapital = usePermission().can("share_capital:view");
  const [shareCapitalTotal, setShareCapitalTotal] = useState<string>("—");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyDues, setDailyDues] = useState<DueItemView[]>([]);
  const [duesSummary, setDuesSummary] = useState<DailyDuesSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransactionRow[]>([]);
  // "loading" until the request settles, then "ready" or "error" — so the UI can
  // tell a genuinely empty dataset apart from a request that never came back.
  const [txStatus, setTxStatus] = useState<LoadState>("loading");
  const [duesStatus, setDuesStatus] = useState<LoadState>("loading");

  useEffect(() => {
    // Needs `share_capital:view`, which the dashboard does not; without it the
    // card keeps its "—" rather than asking for figures it would be refused.
    if (canViewShareCapital) {
      // The book's balance as the server states it (`meta.totals`); one row is
      // asked for because only the totals are read.
      shareCapitalService
        .members({ per_page: 1 })
        .then((res) => {
          const balance = shareCapitalBookBalance(res);
          setShareCapitalTotal(balance === null ? "—" : formatCompactCurrency(balance));
        })
        .catch(() => {
          setShareCapitalTotal("—");
        });
    }

    // Dashboard stats
    dashboardService
      .stats()
      .then((res) => {
        if (res && typeof res === "object") setStats(res as DashboardStats);
      })
      .catch(() => {});


    // Daily dues
    dashboardService
      .dailyDues<DailyDueItem>()
      .then((res) => {
        setDailyDues(dueItemViews(Array.isArray(res?.data) ? res.data : []));
        setDuesSummary(res?.summary ?? null);
        setDuesStatus("ready");
      })
      .catch(() => {
        setDailyDues([]);
        setDuesSummary(null);
        setDuesStatus("error");
      });

    // Recent transactions
    dashboardService
      .recentTransactions()
      .then((res) => {
        setRecentTransactions(recentTransactionRows(res));
        setTxStatus("ready");
      })
      .catch(() => {
        setRecentTransactions([]);
        setTxStatus("error");
      });
  }, [canViewShareCapital]);

  // ---------------------------------------------------------------------
  // Derived values — live data only.
  // ---------------------------------------------------------------------
  // If a request is still in flight or failed we show an em dash, never a
  // stand-in figure: a placeholder here is indistinguishable from a real
  // balance and would misrepresent the co-op's books.
  const kpiValues: Record<typeof KPI_CARD_STRUCTURE[number]["key"], string> = {
    portfolio: stats?.total_portfolio != null ? formatCompactCurrency(stats.total_portfolio) : "—",
    active_loans: stats?.active_loans != null ? String(stats.active_loans) : "—",
    collected: stats?.total_collected != null ? formatCompactCurrency(stats.total_collected) : "—",
    overdue: stats?.overdue_count != null ? String(stats.overdue_count) : "—",
    share_capital: shareCapitalTotal,
  };
  // The premium the Collected figure leaves out, as the server sent it.
  const insuranceCollectedAmount = insuranceCollected(stats);
  const insuranceCollectedLabel =
    insuranceCollectedAmount === null ? "—" : formatCompactCurrency(insuranceCollectedAmount);

  const dueItems = dailyDues;
  const transactions = recentTransactions;

  // The pie, the rate and the "Today" list are the server's figures (GET
  // /dashboard/daily-dues `summary`); a row's "Paid" includes penalty, so adding
  // rows up here could pass 100%.
  const collectionRate = shownCollectionRate(duesSummary);
  const collectionRateLabel = collectionRate === null ? "—" : `${collectionRate}%`;
  const pieData = collectionPieSlices(duesSummary);
  const todayRows = todaySummaryRows(duesSummary);
  const nothingDue = isNothingDue(duesSummary, duesStatus);
  const badge = collectionBadge(collectionRate, nothingDue);
  const BadgeArrow = badge.arrow === "up" ? TrendingUp : badge.arrow === "down" ? TrendingDown : null;
  const rateBadgeClass = {
    good: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
    fair: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    poor: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
    unknown: "border-border bg-muted text-muted-foreground",
  }[badge.tone];

  return (
    <>
      {/* ----------------------------------------------------------------- */}
      {/* Row 1: KPI Cards (compact, natural height)                        */}
      {/* ----------------------------------------------------------------- */}
      <div className={kpiClasses.grid}>
        {KPI_CARD_STRUCTURE.map((kpi) => {
          // Only draw a trend line when the backend actually sent that
          // series — no decorative curve next to a real figure.
          const series = sparklinePoints(kpi.sparkKey ? stats?.sparklines?.[kpi.sparkKey] : undefined);
          return (
            <Link key={kpi.label} href={kpi.href} className="group">
              <Card
                size="sm"
                className={cn(
                  kpiClasses.card,
                  "h-full rounded-xl border border-border shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:border-brand-orange/30 group-hover:scale-[1.02] cursor-pointer",
                )}
              >
                <CardContent className={kpiClasses.content}>
                  <div className={kpiClasses.row}>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Icon3D name={KPI_ICONS_3D[kpi.key]} size={28} eager />
                      <div className="min-w-0">
                        <p className="text-lg font-bold leading-tight">{kpiValues[kpi.key]}</p>
                        <p className="text-[11px] leading-tight text-muted-foreground">{kpi.label}</p>
                      </div>
                    </div>
                    {hasSparklineData(series) ? (
                      <div className={kpiClasses.sparkline}>
                        <Sparkline data={series} color={kpi.color} />
                      </div>
                    ) : null}
                  </div>
                  {kpi.key === "collected" && (
                    <p className="text-[10px] leading-tight text-muted-foreground tabular-nums">
                      Insurance premium collected: {insuranceCollectedLabel}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Row 2: one full-width card, a tab per table. At fit it takes the  */}
      {/* height left and each table scrolls inside with every column shown. */}
      {/* ----------------------------------------------------------------- */}
      <ExpandableCard
        title="Collections and Transactions"
        description={formatDateFull(new Date())}
        className="rounded-xl border border-border shadow-sm"
        contentClassName="px-0"
        actions={
          <Badge variant="outline" className={rateBadgeClass}>
            {BadgeArrow ? <BadgeArrow data-icon="inline-start" aria-hidden="true" /> : null}
            {badge.text}
          </Badge>
        }
      >
        <Tabs defaultValue="dues" className={cn(FIT_CLASSES.section, "gap-3")}>
          <TabsList className={DUES_TABS_LIST_CLASS}>
            <TabsTrigger value="dues">Daily dues</TabsTrigger>
            <TabsTrigger value="transactions">Recent transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="dues" className={FIT_CLASSES.section}>
            {/* The donut beside the table on a wide card, above it on a narrow one. */}
            <div className="flex flex-col gap-4 @xl:flex-row fit:flex-1 fit:min-h-0">
              <DuesDonut
                rate={collectionRate}
                rateLabel={collectionRateLabel}
                slices={pieData}
                rows={todayRows}
                nothingDue={nothingDue}
                mounted={mounted}
              />
              <div className={DUES_TABLE_PANEL_CLASS}>
                <ScrollBox>
                  <DuesTable items={dueItems} state={duesStatus} />
                </ScrollBox>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="transactions" className={FIT_CLASSES.section}>
            <div className={TRANSACTIONS_TABLE_PANEL_CLASS}>
              <ScrollBox>
                <TransactionsTable rows={transactions} state={txStatus} />
              </ScrollBox>
            </div>
          </TabsContent>
        </Tabs>
      </ExpandableCard>
    </>
  );
}

export default function DashboardPage() {
  return (
    <RouteGuard permission="dashboard:view" pageName="Dashboard">
      <DashboardPageFill />
    </RouteGuard>
  );
}

/** The page root: fills the main area at fit, and is the dashboard's size container. */
function DashboardPageFill() {
  const { can } = usePermission();
  return (
    <PageFill className={cn(DASHBOARD_PAGE_CLASS, "gap-4")}>
      <NoBranchBanner />
      {showExecutiveLink(env.features.executiveDashboard, can) ? (
        <div className="flex shrink-0 justify-end">
          <Link
            href="/dashboard/executive"
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            <BarChart3 className="size-3.5" aria-hidden="true" />
            Executive Dashboard
          </Link>
        </div>
      ) : null}
      <DashboardContent />
    </PageFill>
  );
}
