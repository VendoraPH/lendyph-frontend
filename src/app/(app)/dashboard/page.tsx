"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/common";
import { dashboardService } from "@/services";
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
import { Wallet, FileText, DollarSign, AlertTriangle, TrendingUp, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));

const formatCompact = (amount: number) => {
  if (amount >= 1_000_000) return `₱${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₱${(amount / 1_000).toFixed(0)}K`;
  return formatCurrency(amount);
};

// ---------------------------------------------------------------------------
// Types for API responses
// ---------------------------------------------------------------------------

interface DashboardStats {
  total_portfolio?: number;
  active_loans?: number;
  total_collected?: number;
  overdue_count?: number;
  // sparkline arrays (optional — API may not return these)
  portfolio_trend?: { v: number }[];
  loans_trend?: { v: number }[];
  collected_trend?: { v: number }[];
  overdue_trend?: { v: number }[];
}

interface CollectionsTrendItem {
  day?: string;
  week?: string;
  label?: string;
  value: number;
}

interface DailyDueItem {
  id: number;
  borrower: string;
  borrower_name?: string;
  loan_id?: string;
  loan_account_number?: string;
  amount_due: number;
  amount_paid: number;
  status: "collected" | "partial" | "pending";
}

interface RecentTransaction {
  id: number;
  name?: string;
  borrower_name?: string;
  description?: string;
  desc?: string;
  amount: number;
  date: string;
  type?: string;
}

// ---------------------------------------------------------------------------
// Mock / fallback data
// ---------------------------------------------------------------------------

const SPARKLINE_PURPLE = [
  { v: 120 }, { v: 135 }, { v: 128 }, { v: 145 }, { v: 152 }, { v: 148 }, { v: 160 },
];
const SPARKLINE_ORANGE = [
  { v: 800 }, { v: 810 }, { v: 820 }, { v: 815 }, { v: 830 }, { v: 838 }, { v: 843 },
];
const SPARKLINE_GREEN = [
  { v: 180 }, { v: 195 }, { v: 210 }, { v: 205 }, { v: 220 }, { v: 235 }, { v: 240 },
];
const SPARKLINE_BLUE = [
  { v: 40 }, { v: 42 }, { v: 41 }, { v: 43 }, { v: 44 }, { v: 46 }, { v: 47 },
];

const MOCK_STATS: DashboardStats = {
  total_portfolio: 15_200_000,
  active_loans: 843,
  total_collected: 2_400_000,
  overdue_count: 47,
};

const MOCK_COLLECTIONS_TREND: CollectionsTrendItem[] = [
  { day: "W1",  value: 380000 },
  { day: "W2",  value: 520000 },
  { day: "W3",  value: 450000 },
  { day: "W4",  value: 680000 },
  { day: "W5",  value: 620000 },
  { day: "W6",  value: 890000 },
  { day: "W7",  value: 780000 },
  { day: "W8",  value: 950000 },
  { day: "W9",  value: 870000 },
  { day: "W10", value: 1020000 },
  { day: "W11", value: 960000 },
  { day: "W12", value: 1100000 },
];

const MOCK_DAILY_DUES: DailyDueItem[] = [
  { id: 1, borrower: "Rosario D. Santos", loan_id: "LN-2026-0042", amount_due: 5500, amount_paid: 5500, status: "collected" },
  { id: 2, borrower: "Roberto Garcia", loan_id: "LN-2026-0078", amount_due: 9417, amount_paid: 9417, status: "collected" },
  { id: 3, borrower: "Eduardo Mendoza", loan_id: "LN-2026-0103", amount_due: 4708, amount_paid: 4708, status: "collected" },
  { id: 4, borrower: "Maria L. Reyes", loan_id: "LN-2026-0055", amount_due: 3200, amount_paid: 958, status: "partial" },
  { id: 5, borrower: "Ana Santos", loan_id: "LN-2026-0091", amount_due: 6800, amount_paid: 0, status: "pending" },
  { id: 6, borrower: "Carmen Torres", loan_id: "LN-2026-0112", amount_due: 12000, amount_paid: 0, status: "pending" },
  { id: 7, borrower: "Jose Dela Cruz", loan_id: "LN-2026-0067", amount_due: 2500, amount_paid: 0, status: "pending" },
];

const MOCK_RECENT_TX: RecentTransaction[] = [
  { id: 1, name: "Rosario D. Santos", desc: "Payment via GCash", amount: 3933, date: "Mar 31, 9:42 AM", type: "payment" },
  { id: 2, name: "Roberto Garcia", desc: "Cash payment received", amount: 9417, date: "Mar 31, 9:15 AM", type: "payment" },
  { id: 3, name: "Ana Santos", desc: "Loan released — Bank Transfer", amount: 15000, date: "Mar 30, 3:20 PM", type: "release" },
  { id: 4, name: "Eduardo Mendoza", desc: "Payment via Bank Transfer", amount: 4708, date: "Mar 30, 2:10 PM", type: "payment" },
  { id: 5, name: "Maria L. Reyes", desc: "Payment via Maya", amount: 958, date: "Mar 29, 11:05 AM", type: "payment" },
  { id: 6, name: "Carmen Torres", desc: "Loan released — Bank Transfer", amount: 50000, date: "Mar 29, 10:30 AM", type: "release" },
];

const AVATAR_COLORS = ["bg-purple-500", "bg-orange-500", "bg-green-500", "bg-blue-500", "bg-pink-500", "bg-indigo-500"];

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
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  // API data state
  const [stats, setStats] = useState<DashboardStats>(MOCK_STATS);
  const [collectionsTrend, setCollectionsTrend] = useState<CollectionsTrendItem[]>(MOCK_COLLECTIONS_TREND);
  const [dailyDues, setDailyDues] = useState<DailyDueItem[]>(MOCK_DAILY_DUES);
  const [recentTx, setRecentTx] = useState<RecentTransaction[]>(MOCK_RECENT_TX);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      dashboardService.stats(),
      dashboardService.collectionsTrend(),
      dashboardService.dailyDues(),
      dashboardService.recentTransactions(),
    ]);

    // Stats
    if (results[0].status === "fulfilled" && results[0].value) {
      setStats(results[0].value as DashboardStats);
    }
    // Collections trend
    if (results[1].status === "fulfilled" && Array.isArray(results[1].value)) {
      const trend = results[1].value as CollectionsTrendItem[];
      if (trend.length > 0) setCollectionsTrend(trend);
    }
    // Daily dues
    if (results[2].status === "fulfilled") {
      const raw = results[2].value;
      const items = Array.isArray(raw) ? raw : (raw as { data?: DailyDueItem[] })?.data;
      if (Array.isArray(items) && items.length > 0) setDailyDues(items as DailyDueItem[]);
    }
    // Recent transactions
    if (results[3].status === "fulfilled") {
      const raw = results[3].value;
      const items = Array.isArray(raw) ? raw : (raw as { data?: RecentTransaction[] })?.data;
      if (Array.isArray(items) && items.length > 0) setRecentTx(items as RecentTransaction[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchDashboard();
  }, [fetchDashboard]);

  // Derived values
  const kpiCards = useMemo(() => [
    {
      icon: Wallet,
      value: formatCompact(stats.total_portfolio ?? 0),
      label: "Total Portfolio",
      color: "#7c3aed",
      sparkData: stats.portfolio_trend ?? SPARKLINE_PURPLE,
      href: "/loans",
    },
    {
      icon: FileText,
      value: String(stats.active_loans ?? 0),
      label: "Active Loans",
      color: "#e879f9",
      sparkData: stats.loans_trend ?? SPARKLINE_ORANGE,
      href: "/loans",
    },
    {
      icon: DollarSign,
      value: formatCompact(stats.total_collected ?? 0),
      label: "Collected",
      color: "#10b981",
      sparkData: stats.collected_trend ?? SPARKLINE_GREEN,
      href: "/payments",
    },
    {
      icon: AlertTriangle,
      value: String(stats.overdue_count ?? 0),
      label: "Overdue",
      color: "#f87171",
      sparkData: stats.overdue_trend ?? SPARKLINE_BLUE,
      href: "/loans",
    },
  ], [stats]);

  // Daily due computed values
  const totalDue = dailyDues.reduce((sum, i) => sum + (i.amount_due ?? 0), 0);
  const totalCollected = dailyDues.reduce((sum, i) => sum + (i.amount_paid ?? 0), 0);
  const totalPartial = dailyDues.filter((i) => i.status === "partial").reduce((sum, i) => sum + (i.amount_paid ?? 0), 0);
  const totalFullyCollected = totalCollected - totalPartial;
  const totalRemaining = totalDue - totalCollected;
  const collectionRate = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0;

  const collectionPieData = [
    { name: "Collected", value: totalFullyCollected, color: "#10b981" },
    { name: "Partial", value: totalPartial, color: "#f59e0b" },
    { name: "Pending", value: totalRemaining, color: "#94a3b8" },
  ];

  // Trend chart data key
  const trendDataKey = collectionsTrend[0]?.day ? "day" : collectionsTrend[0]?.week ? "week" : "label";

  return (
    <RouteGuard permission="dashboard:view" pageName="Dashboard">
    <div className="space-y-6">
      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
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
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <p className="text-lg font-bold leading-tight">{kpi.value}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                    </div>
                  </div>
                  <Sparkline data={kpi.sparkData} color={kpi.color} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Row 2: Expected vs Actual Daily Collection */}
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
                        data={collectionPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                        isAnimationActive={false}
                      >
                        {collectionPieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value))}
                        contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid var(--border)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : null}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-2xl font-bold">{collectionRate}%</p>
                  <p className="text-[11px] text-muted-foreground">Collected</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2">
                {collectionPieData.map((entry) => (
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
                {dailyDues.map((item, i) => {
                  const borrowerName = item.borrower_name ?? item.borrower ?? "—";
                  const loanId = item.loan_account_number ?? item.loan_id ?? "—";
                  return (
                    <TableRow key={`due-${item.id ?? i}`} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-purple-500/15 flex items-center justify-center text-xs font-semibold text-purple-700 dark:text-purple-300 shrink-0">
                            {getInitials(borrowerName)}
                          </div>
                          <span className="font-medium text-sm whitespace-nowrap">{borrowerName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{loanId}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(item.amount_due)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {item.amount_paid > 0 ? formatCurrency(item.amount_paid) : "—"}
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Row 3: Collections Trend Chart */}
      <Card className="rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-6">
          <div className="mb-4">
            <p className="text-3xl font-bold tracking-tight">{formatCurrency(stats.total_collected ?? 0)}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Collections (12-week trend)</p>
          </div>
          <div style={{ height: 200 }}>
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={collectionsTrend} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                  <defs>
                    <linearGradient id="collectionsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey={trendDataKey}
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid var(--border)" }}
                  />
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
      </Card>

      {/* Row 4: Recent Transactions Table */}
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
                {recentTx.map((tx, idx) => {
                  const txName = tx.borrower_name ?? tx.name ?? "—";
                  const txDesc = tx.description ?? tx.desc ?? "—";
                  const initials = getInitials(txName);
                  const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                  return (
                    <TableRow key={`tx-${tx.id ?? idx}`} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 ${avatarColor}`}
                          >
                            {initials}
                          </div>
                          <span className="font-medium text-sm whitespace-nowrap">{txName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{txDesc}</TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(tx.amount)}
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
