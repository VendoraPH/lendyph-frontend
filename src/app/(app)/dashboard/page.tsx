"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/common";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
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
  // click and on Next's prefetch. `/loans/past-due` is the purpose-built Past
  // Due Loans report, which is exactly what this card counts.
  { key: "overdue" as const, sparkKey: "overdue" as const, icon: AlertTriangle, label: "Overdue", color: "#f87171", href: "/loans/past-due" },
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
// Section visibility flags
// ---------------------------------------------------------------------------
// These dashboard sections are hidden temporarily — the underlying numbers
// are placeholder/demo data and we don't want to show them to users until
// they're driven by real backend metrics. Flip to `true` to bring them back.

const SHOW_DAILY_COLLECTION_VS_ACTUAL = false;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function formatCompactCurrency(amount: number): string {
  if (amount >= 1_000_000) return `₱${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₱${(amount / 1_000).toFixed(0)}K`;
  return `₱${Math.round(amount).toLocaleString()}`;
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [shareCapitalTotal, setShareCapitalTotal] = useState<string>("—");
  const [stats, setStats] = useState<DashboardStats | null>(null);
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
