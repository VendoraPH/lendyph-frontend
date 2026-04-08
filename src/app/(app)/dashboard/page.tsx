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
import { Wallet, FileText, DollarSign, AlertTriangle, TrendingUp, CircleCheck, Clock, CircleAlert } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// Mock data
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

// Mini area chart for left side of main card
const COLLECTIONS_TREND = [
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

// Mock data — Loans due today vs actual collections
const DAILY_DUE_ITEMS = [
  { id: 1, borrower: "Rosario D. Santos", loanId: "LN-2026-0042", amountDue: 5500, amountPaid: 5500, status: "collected" as const },
  { id: 2, borrower: "Roberto Garcia", loanId: "LN-2026-0078", amountDue: 9417, amountPaid: 9417, status: "collected" as const },
  { id: 3, borrower: "Eduardo Mendoza", loanId: "LN-2026-0103", amountDue: 4708, amountPaid: 4708, status: "collected" as const },
  { id: 4, borrower: "Maria L. Reyes", loanId: "LN-2026-0055", amountDue: 3200, amountPaid: 958, status: "partial" as const },
  { id: 5, borrower: "Ana Santos", loanId: "LN-2026-0091", amountDue: 6800, amountPaid: 0, status: "pending" as const },
  { id: 6, borrower: "Carmen Torres", loanId: "LN-2026-0112", amountDue: 12000, amountPaid: 0, status: "pending" as const },
  { id: 7, borrower: "Jose Dela Cruz", loanId: "LN-2026-0067", amountDue: 2500, amountPaid: 0, status: "pending" as const },
];

const TOTAL_DUE = DAILY_DUE_ITEMS.reduce((sum, item) => sum + item.amountDue, 0);
const TOTAL_COLLECTED = DAILY_DUE_ITEMS.reduce((sum, item) => sum + item.amountPaid, 0);
const TOTAL_PARTIAL = DAILY_DUE_ITEMS.filter((i) => i.status === "partial").reduce((sum, i) => sum + i.amountPaid, 0);
const TOTAL_FULLY_COLLECTED = TOTAL_COLLECTED - TOTAL_PARTIAL;
const TOTAL_REMAINING = TOTAL_DUE - TOTAL_COLLECTED;
const COLLECTION_RATE = Math.round((TOTAL_COLLECTED / TOTAL_DUE) * 100);

const COLLECTION_PIE_DATA = [
  { name: "Collected", value: TOTAL_FULLY_COLLECTED, color: "#10b981" },
  { name: "Partial", value: TOTAL_PARTIAL, color: "#f59e0b" },
  { name: "Pending", value: TOTAL_REMAINING, color: "#94a3b8" },
];

const RECENT_TRANSACTIONS = [
  { id: 1, name: "Rosario D. Santos", desc: "Payment via GCash", amount: 3933, date: "Mar 31, 9:42 AM", color: "bg-purple-500" },
  { id: 2, name: "Roberto Garcia", desc: "Cash payment received", amount: 9417, date: "Mar 31, 9:15 AM", color: "bg-orange-500" },
  { id: 3, name: "Ana Santos", desc: "Loan released — Bank Transfer", amount: 15000, date: "Mar 30, 3:20 PM", color: "bg-green-500" },
  { id: 4, name: "Eduardo Mendoza", desc: "Payment via Bank Transfer", amount: 4708, date: "Mar 30, 2:10 PM", color: "bg-blue-500" },
  { id: 5, name: "Maria L. Reyes", desc: "Payment via Maya", amount: 958, date: "Mar 29, 11:05 AM", color: "bg-purple-500" },
  { id: 6, name: "Carmen Torres", desc: "Loan released — Bank Transfer", amount: 50000, date: "Mar 29, 10:30 AM", color: "bg-orange-500" },
];

// ---------------------------------------------------------------------------
// KPI Card data
// ---------------------------------------------------------------------------

const KPI_CARDS = [
  {
    icon: Wallet,
    value: "₱15.2M",
    label: "Total Portfolio",
    color: "#7c3aed",
    sparkData: SPARKLINE_PURPLE,
    href: "/loans",
  },
  {
    icon: FileText,
    value: "843",
    label: "Active Loans",
    color: "#e879f9",
    sparkData: SPARKLINE_ORANGE,
    href: "/loans",
  },
  {
    icon: DollarSign,
    value: "₱2.4M",
    label: "Collected",
    color: "#10b981",
    sparkData: SPARKLINE_GREEN,
    href: "/payments",
  },
  {
    icon: AlertTriangle,
    value: "47",
    label: "Overdue",
    color: "#f87171",
    sparkData: SPARKLINE_BLUE,
    href: "/collections",
  },
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
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [activePeriod, setActivePeriod] = useState<(typeof TIME_PERIODS)[number]>("1M");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <RouteGuard permission="dashboard:view" pageName="Dashboard">
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Row 1: KPI Cards                                                  */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map((kpi) => (
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
                      <p className="text-lg font-bold leading-tight">{kpi.value}</p>
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

      {/* ----------------------------------------------------------------- */}
      {/* Row 2: Expected vs Actual Daily Collection                        */}
      {/* ----------------------------------------------------------------- */}
      <Card className="rounded-xl border border-border shadow-sm">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold">Expected Daily Collection vs Actual Collection</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <Badge variant="outline" className={COLLECTION_RATE >= 80 ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400" : COLLECTION_RATE >= 50 ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"}>
              <TrendingUp className="h-3 w-3 mr-1" />
              {COLLECTION_RATE}% collected
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
                        data={COLLECTION_PIE_DATA}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                        isAnimationActive={false}
                      >
                        {COLLECTION_PIE_DATA.map((entry) => (
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
                  <p className="text-2xl font-bold">{COLLECTION_RATE}%</p>
                  <p className="text-[11px] text-muted-foreground">Collected</p>
                </div>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 mt-2">
                {COLLECTION_PIE_DATA.map((entry) => (
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
                {DAILY_DUE_ITEMS.map((item) => (
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

      {/* ----------------------------------------------------------------- */}
      {/* Row 3: Main Chart Card — full width single column                 */}
      {/* ----------------------------------------------------------------- */}
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
                  <AreaChart data={COLLECTIONS_TREND} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
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
                {RECENT_TRANSACTIONS.map((tx) => {
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
