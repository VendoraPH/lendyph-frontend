"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/common";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Wallet, FileText, DollarSign, AlertTriangle, TrendingUp, CircleCheck, Clock, CircleAlert, Landmark } from "lucide-react";
import { shareCapitalService } from "@/services";
import { dashboardService } from "@/services/dashboard.service";
import type { ShareCapitalLedgerEntry } from "@/types";

// ---------------------------------------------------------------------------
// Backend response shapes
// ---------------------------------------------------------------------------
// Wire defensively (the API is tolerant about field names), but NEVER
// substitute invented data when a response is empty or fails — an empty
// dashboard must read as empty. See the empty/loading states below.

type SparklinePoint = { v: number };

/** Sparkline series returned by GET /dashboard/stats. Keys mirror KPI_CARD_STRUCTURE. */
type SparklineKey = "portfolio" | "active_loans" | "collected" | "overdue";

interface DashboardStats {
  total_portfolio?: number;
  active_loans?: number;
  total_collected?: number;
  overdue_count?: number;
  share_capital_total?: number;
  sparklines?: Partial<Record<SparklineKey, SparklinePoint[]>>;
}

interface CollectionsTrendPoint {
  period_label?: string;
  label?: string;
  day?: string;
  value?: number;
  amount?: number;
}

interface DailyDueItem {
  id?: number;
  borrower?: string;
  borrower_name?: string;
  loan_id?: number | string;
  loan_account_number?: string;
  amount_due?: number;
  amount_paid?: number;
  status?: "paid" | "partial" | "overdue" | "pending" | "collected";
}

interface RecentTransactionItem {
  id?: number;
  name?: string;
  borrower_name?: string;
  description?: string;
  desc?: string;
  amount?: number;
  date?: string;
  created_at?: string;
  type?: "release" | "repayment";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// View models — what the UI renders, after mapping the API response
// ---------------------------------------------------------------------------

/** Request lifecycle for a section, so empty data and a failed fetch render differently. */
type LoadState = "loading" | "ready" | "error";

type TrendPoint = { day: string; value: number };

type DueItemView = {
  id: number;
  borrower: string;
  loanId: string;
  amountDue: number;
  amountPaid: number;
  status: "collected" | "partial" | "pending";
};

type TransactionView = {
  id: number;
  name: string;
  desc: string;
  amount: number;
  date: string;
  color: string;
};

// Candlestick data — open/close/high/low per day (like the reference screenshot)
const CANDLESTICK_DATA = [
  { date: "12", open: 42, close: 48, high: 52, low: 38, volume: 35 },
  { date: "13", open: 48, close: 38, high: 50, low: 35, volume: 28 },
  { date: "14", open: 38, close: 55, high: 58, low: 36, volume: 52 },
  { date: "15", open: 55, close: 48, high: 57, low: 45, volume: 40 },
  { date: "16", open: 48, close: 62, high: 65, low: 46, volume: 60 },
  { date: "17", open: 62, close: 35, high: 64, low: 32, volume: 45 },
  { date: "18", open: 35, close: 41, high: 44, low: 33, volume: 22 },
  { date: "19", open: 41, close: 58, high: 61, low: 39, volume: 55 },
  { date: "20", open: 58, close: 52, high: 60, low: 49, volume: 30 },
  { date: "21", open: 52, close: 67, high: 70, low: 50, volume: 65 },
  { date: "22", open: 67, close: 45, high: 69, low: 42, volume: 48 },
  { date: "23", open: 45, close: 71, high: 74, low: 43, volume: 70 },
  { date: "24", open: 71, close: 63, high: 73, low: 60, volume: 38 },
  { date: "25", open: 63, close: 58, high: 66, low: 55, volume: 25 },
  { date: "26", open: 58, close: 74, high: 78, low: 56, volume: 58 },
  { date: "27", open: 74, close: 49, high: 76, low: 46, volume: 42 },
  { date: "28", open: 49, close: 82, high: 85, low: 47, volume: 72 },
  { date: "29", open: 82, close: 68, high: 84, low: 65, volume: 50 },
  { date: "30", open: 68, close: 76, high: 80, low: 66, volume: 44 },
  { date: "31", open: 76, close: 85, high: 88, low: 74, volume: 68 },
];

// ---------------------------------------------------------------------------
// KPI Card structure (values and sparklines populated from state)
// ---------------------------------------------------------------------------
// `sparkKey` is the series name in stats.sparklines. Share Capital has no
// series from the backend, so its card renders no sparkline rather than a
// decorative one.

const KPI_CARD_STRUCTURE = [
  { key: "portfolio" as const, sparkKey: "portfolio" as const, icon: Wallet, label: "Total Portfolio", color: "#7c3aed", href: "/loans" },
  { key: "active_loans" as const, sparkKey: "active_loans" as const, icon: FileText, label: "Active Loans", color: "#e879f9", href: "/loans" },
  { key: "collected" as const, sparkKey: "collected" as const, icon: DollarSign, label: "Collected", color: "#10b981", href: "/payments" },
  // `/collections` is not a route — it never existed, so this card 404'd on
  // click and on Next's prefetch. Point it at the loans list filtered to the
  // overdue status, which is what the card counts.
  { key: "overdue" as const, sparkKey: "overdue" as const, icon: AlertTriangle, label: "Overdue", color: "#f87171", href: "/loans?tab=past_due" },
  { key: "share_capital" as const, sparkKey: null, icon: Landmark, label: "Share Capital", color: "#14b8a6", href: "/share-capital/ledger" },
];

// ---------------------------------------------------------------------------
// Sparkline component
// ---------------------------------------------------------------------------

function Sparkline({ data, color }: { data: { v: number }[]; color: string }) {
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
        dot={false}
        isAnimationActive={false}
      />
    </AreaChart>
  );
}

// ---------------------------------------------------------------------------
// Placeholder row for a table with nothing to show
// ---------------------------------------------------------------------------

function TableEmptyRow({
  colSpan,
  state,
  emptyText,
}: {
  colSpan: number;
  state: LoadState;
  emptyText: string;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
        {state === "loading"
          ? "Loading…"
          : state === "error"
            ? "Couldn't load this data. Please refresh the page."
            : emptyText}
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Candlestick shape renderer
// ---------------------------------------------------------------------------

function CandlestickShape(props: Record<string, unknown>) {
  const { x, y, width, height, payload } = props as {
    x: number;
    y: number;
    width: number;
    height: number;
    payload: (typeof CANDLESTICK_DATA)[0];
  };

  if (!payload) return null;

  const isUp = payload.close >= payload.open;
  const color = isUp ? "#10b981" : "#7c3aed";

  // Scale values to chart coordinates
  // The bar is rendered at (x, y) with given width/height
  // We need to calculate wick positions relative to the bar
  const centerX = x + width / 2;
  const bodyWidth = Math.max(width * 0.25, 3);
  const bodyX = centerX - bodyWidth / 2;

  // Wick extends slightly above and below the body
  const wickTop = y - (height * 0.15);
  const wickBottom = y + height + (height * 0.15);

  return (
    <g>
      {/* Wick (thin line) */}
      <line
        x1={centerX}
        y1={wickTop}
        x2={centerX}
        y2={wickBottom}
        stroke={color}
        strokeWidth={1}
      />
      {/* Body (narrow rectangle) */}
      <rect
        x={bodyX}
        y={y}
        width={bodyWidth}
        height={Math.max(height, 2)}
        fill={color}
        rx={1}
        ry={1}
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip for candlestick chart
// ---------------------------------------------------------------------------

function CandlestickTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: (typeof CANDLESTICK_DATA)[0] }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isUp = d.close >= d.open;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-medium mb-1">Mar {label}</p>
      <div className="space-y-0.5">
        <p>Open: <span className="font-semibold">₱{d.open}K</span></p>
        <p>Close: <span className={`font-semibold ${isUp ? "text-[#10b981]" : "text-[#7c3aed]"}`}>₱{d.close}K</span></p>
        <p>High: ₱{d.high}K · Low: ₱{d.low}K</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time period toggle
// ---------------------------------------------------------------------------

const TIME_PERIODS = ["1D", "1W", "1M", "3M", "1Y"] as const;

// ---------------------------------------------------------------------------
// Section visibility flags
// ---------------------------------------------------------------------------
// These dashboard sections are hidden temporarily — the underlying numbers
// are placeholder/demo data and we don't want to show them to users until
// they're driven by real backend metrics. Flip to `true` to bring them back.

const SHOW_DAILY_COLLECTION_VS_ACTUAL = false;
const SHOW_TOTAL_COLLECTIONS_HERO = false;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function formatCompactCurrency(amount: number): string {
  if (amount >= 1_000_000) return `₱${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₱${(amount / 1_000).toFixed(0)}K`;
  return `₱${Math.round(amount).toLocaleString()}`;
}

export default function DashboardPage() {
  const [activePeriod, setActivePeriod] = useState<(typeof TIME_PERIODS)[number]>("1M");
  const [mounted, setMounted] = useState(false);
  const [shareCapitalTotal, setShareCapitalTotal] = useState<string>("—");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [dailyDues, setDailyDues] = useState<DueItemView[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionView[]>([]);
  // "loading" until the request settles, then "ready" or "error" — so the UI can
  // tell a genuinely empty dataset apart from a request that never came back.
  const [txStatus, setTxStatus] = useState<LoadState>("loading");
  const [duesStatus, setDuesStatus] = useState<LoadState>("loading");

  useEffect(() => {
    setMounted(true);

    // Share capital — existing, kept as-is
    shareCapitalService
      .ledgerList({ per_page: 9999 })
      .then((res) => {
        const entries = (res.data ?? res as unknown as ShareCapitalLedgerEntry[]);
        const items = Array.isArray(entries) ? entries : [];
        let total = 0;
        for (const e of items) {
          // Defensive coercion — bad/missing amounts shouldn't poison the running
          // total with NaN (which would propagate to "₱NaN" in the UI).
          const amount = Number(e.amount);
          if (!Number.isFinite(amount)) continue;
          total += e.type === "credit" ? amount : -amount;
        }
        setShareCapitalTotal(formatCompactCurrency(Number.isFinite(total) ? total : 0));
      })
      .catch(() => {
        setShareCapitalTotal("—");
      });

    // Dashboard stats
    dashboardService
      .stats()
      .then((res) => {
        if (res && typeof res === "object") setStats(res as DashboardStats);
      })
      .catch(() => {});

    // Collections trend
    dashboardService
      .collectionsTrend()
      .then((res) => {
        const raw = Array.isArray(res)
          ? (res as CollectionsTrendPoint[])
          : ((res as { data?: CollectionsTrendPoint[] })?.data ?? []);
        setTrendData(
          raw.map((p, i) => ({
            day: p.period_label ?? p.label ?? p.day ?? `W${i + 1}`,
            value: Number(p.value ?? p.amount ?? 0),
          })),
        );
      })
      .catch(() => {
        setTrendData([]);
      });

    // Daily dues
    dashboardService
      .dailyDues()
      .then((res) => {
        const raw = Array.isArray(res)
          ? (res as DailyDueItem[])
          : ((res as { data?: DailyDueItem[] })?.data ?? []);
        const statusMap: Record<string, DueItemView["status"]> = {
          paid: "collected",
          collected: "collected",
          partial: "partial",
          overdue: "pending",
          pending: "pending",
        };
        setDailyDues(
          raw.map((item, i) => ({
            id: Number(item.id ?? i + 1),
            borrower: item.borrower ?? item.borrower_name ?? "—",
            loanId: String(item.loan_account_number ?? item.loan_id ?? "—"),
            amountDue: Number(item.amount_due ?? 0),
            amountPaid: Number(item.amount_paid ?? 0),
            status: statusMap[item.status ?? "pending"] ?? "pending",
          })),
        );
        setDuesStatus("ready");
      })
      .catch(() => {
        setDailyDues([]);
        setDuesStatus("error");
      });

    // Recent transactions
    dashboardService
      .recentTransactions()
      .then((res) => {
        const raw = Array.isArray(res)
          ? (res as RecentTransactionItem[])
          : ((res as { data?: RecentTransactionItem[] })?.data ?? []);
        const palette = ["bg-purple-500", "bg-orange-500", "bg-green-500", "bg-blue-500"];
        setRecentTransactions(
          raw.slice(0, 10).map((tx, i) => ({
            id: Number(tx.id ?? i + 1),
            name: tx.name ?? tx.borrower_name ?? "—",
            desc: tx.description ?? tx.desc ?? (tx.type === "release" ? "Loan released" : "Payment received"),
            amount: Number(tx.amount ?? 0),
            date: tx.date ?? tx.created_at ?? "",
            color: palette[i % palette.length]!,
          })),
        );
        setTxStatus("ready");
      })
      .catch(() => {
        setRecentTransactions([]);
        setTxStatus("error");
      });
  }, []);

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

  const collectionsTrend = trendData;
  const dueItems = dailyDues;
  const transactions = recentTransactions;

  const totalDue = dueItems.reduce((sum, item) => sum + item.amountDue, 0);
  const totalCollected = dueItems.reduce((sum, item) => sum + item.amountPaid, 0);
  const totalPartial = dueItems
    .filter((i) => i.status === "partial")
    .reduce((sum, i) => sum + i.amountPaid, 0);
  const totalFullyCollected = totalCollected - totalPartial;
  const totalRemaining = totalDue - totalCollected;
  const collectionRate = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0;
  const pieData = [
    { name: "Collected", value: totalFullyCollected, color: "#10b981" },
    { name: "Partial", value: totalPartial, color: "#f59e0b" },
    { name: "Pending", value: totalRemaining, color: "#94a3b8" },
  ];

  return (
    <RouteGuard permission="dashboard:view" pageName="Dashboard">
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Row 1: KPI Cards                                                  */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {KPI_CARD_STRUCTURE.map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className="group">
            <Card className="rounded-xl border border-border shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:border-brand-orange/30 group-hover:scale-[1.02] cursor-pointer">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: kpi.color }}
                    >
                      <kpi.icon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div>
                      <p className="text-lg font-bold leading-tight">{kpiValues[kpi.key]}</p>
                      <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                    </div>
                  </div>
                  {(() => {
                    // Only draw a trend line when the backend actually sent that
                    // series — no decorative curve next to a real figure.
                    const series = kpi.sparkKey ? stats?.sparklines?.[kpi.sparkKey] : undefined;
                    return series?.length ? <Sparkline data={series} color={kpi.color} /> : null;
                  })()}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Row 2: Expected vs Actual Daily Collection                        */}
      {/* Hidden via SHOW_DAILY_COLLECTION_VS_ACTUAL — flip flag to restore. */}
      {/* ----------------------------------------------------------------- */}
      {SHOW_DAILY_COLLECTION_VS_ACTUAL && (
      <Card className="rounded-xl border border-border shadow-sm">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold">Expected Daily Collection vs Actual Collection</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <Badge variant="outline" className={collectionRate >= 80 ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400" : collectionRate >= 50 ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"}>
              <TrendingUp className="h-3 w-3 mr-1" />
              {collectionRate}% collected
            </Badge>
          </div>

          {/* Pie chart */}
          <div className="mb-5">
            <div className="flex flex-col items-center justify-center">
              <div className="relative" style={{ width: 200, height: 200 }}>
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                        isAnimationActive={false}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => `₱${Number(value).toLocaleString("en-PH")}`}
                        contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid var(--border)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : null}
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-2xl font-bold">{collectionRate}%</p>
                  <p className="text-[11px] text-muted-foreground">Collected</p>
                </div>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 mt-2">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-[11px] text-muted-foreground">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Breakdown table */}
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/50">
                  <TableHead className="pl-6 text-muted-foreground">Borrower</TableHead>
                  <TableHead className="text-muted-foreground">Loan ID</TableHead>
                  <TableHead className="text-right text-muted-foreground">Amount Due</TableHead>
                  <TableHead className="text-right text-muted-foreground">Paid</TableHead>
                  <TableHead className="pr-6 text-right text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dueItems.length === 0 && (
                  <TableEmptyRow
                    colSpan={5}
                    state={duesStatus}
                    emptyText="Nothing due today."
                  />
                )}
                {dueItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-purple-500/15 flex items-center justify-center text-xs font-semibold text-purple-700 dark:text-purple-300 shrink-0">
                          {getInitials(item.borrower)}
                        </div>
                        <span className="font-medium text-sm whitespace-nowrap">{item.borrower}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.loanId}</TableCell>
                    <TableCell className="text-right text-sm font-medium">₱{item.amountDue.toLocaleString("en-PH")}</TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {item.amountPaid > 0 ? `₱${item.amountPaid.toLocaleString("en-PH")}` : "—"}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Badge
                        variant="outline"
                        className={
                          item.status === "collected"
                            ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
                            : item.status === "partial"
                              ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30"
                              : "bg-muted text-muted-foreground border-border"
                        }
                      >
                        {item.status === "collected" ? "Paid" : item.status === "partial" ? "Partial" : "Pending"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Row 3: Main Chart Card — full width single column                 */}
      {/* Hidden via SHOW_TOTAL_COLLECTIONS_HERO — flip flag to restore.    */}
      {/* ----------------------------------------------------------------- */}
      {SHOW_TOTAL_COLLECTIONS_HERO && (
      <Card className="rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          {/* Left column: value + area chart */}
          <div className="flex flex-col justify-between p-6 lg:w-[35%] lg:border-r border-border">
            <div>
              <p className="text-3xl font-bold tracking-tight">₱2,456,890</p>
              <p className="text-sm text-muted-foreground mt-1">Total Collections</p>
              <p className="text-sm font-medium text-green-600 mt-0.5">+12.5%</p>
            </div>
            {/* Purple area chart */}
            <div className="mt-4" style={{ height: 120 }}>
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={collectionsTrend} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                    <defs>
                      <linearGradient id="collectionsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      fill="url(#collectionsGrad)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>

          {/* Right column: time toggles + candlestick chart */}
          <div className="flex-1 p-4 pt-6">
            <div className="flex justify-end mb-2">
              <div className="flex items-center gap-1">
                {TIME_PERIODS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setActivePeriod(p)}
                    className={
                      activePeriod === p
                        ? "bg-purple-600 text-white rounded-full px-3 py-1 text-xs font-medium"
                        : "rounded-full px-3 py-1 text-xs font-medium text-muted-foreground border border-border hover:text-foreground hover:bg-muted transition-colors"
                    }
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            {/* Candlestick chart */}
            {mounted ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={CANDLESTICK_DATA} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={[20, 95]} />
                    <Tooltip content={<CandlestickTooltip />} cursor={{ fill: "transparent" }} />
                    <Bar
                      dataKey="close"
                      shape={<CandlestickShape />}
                      isAnimationActive={false}
                    >
                      {CANDLESTICK_DATA.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.close >= entry.open ? "#10b981" : "#7c3aed"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Volume bars below candlestick */}
                <ResponsiveContainer width="100%" height={60}>
                  <BarChart data={CANDLESTICK_DATA} margin={{ top: 0, right: 8, bottom: 4, left: 8 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "currentColor" }}
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                    />
                    <YAxis hide />
                    <Bar dataKey="volume" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                      {CANDLESTICK_DATA.map((entry, index) => (
                        <Cell
                          key={`vol-${index}`}
                          fill={entry.close >= entry.open ? "#10b981" : "#7c3aed"}
                          fillOpacity={0.6}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : null}
          </div>
        </div>

        {/* Month labels */}
        <div className="flex justify-between px-6 pb-4 pt-1">
          {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m) => (
            <span key={m} className="text-[11px] text-muted-foreground">{m}</span>
          ))}
        </div>
      </Card>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Row 3: Recent Transactions Table                                   */}
      {/* ----------------------------------------------------------------- */}
      <Card className="rounded-xl border border-border shadow-sm">
        <div className="px-6 pt-5 pb-3">
          <h3 className="text-base font-semibold">Recent Transactions</h3>
        </div>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/50">
                  <TableHead className="pl-6 text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">Description</TableHead>
                  <TableHead className="text-right text-muted-foreground">Amount</TableHead>
                  <TableHead className="pr-6 text-right text-muted-foreground">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 && (
                  <TableEmptyRow
                    colSpan={4}
                    state={txStatus}
                    emptyText="No transactions yet. Payments and loan releases will appear here."
                  />
                )}
                {transactions.map((tx) => {
                  const initials = getInitials(tx.name);
                  return (
                    <TableRow key={tx.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 ${tx.color}`}
                          >
                            {initials}
                          </div>
                          <span className="font-medium text-sm whitespace-nowrap">{tx.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tx.desc}</TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        ₱{tx.amount.toLocaleString("en-PH")}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground pr-6">
                        {tx.date}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
    </RouteGuard>
  );
}
