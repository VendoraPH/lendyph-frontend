"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks";
import {
  FilePlus,
  CreditCard,
  ClipboardList,
  FileText,
  DollarSign,
  AlertTriangle,
  Wallet,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate() {
  return new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const phpFormat = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

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

const TARGET = 50000;

// Candlestick-style data: each bar has open/close (body) and high/low (wick)
const CHART_DATA = Array.from({ length: 15 }, (_, i) => {
  const base = 35000 + (((i * 7 + 3) % 10) / 10) * 30000;
  const open = Math.floor(base * (0.88 + Math.random() * 0.06));
  const close = Math.floor(base * (0.94 + Math.random() * 0.12));
  const high = Math.floor(Math.max(open, close) * (1.03 + Math.random() * 0.04));
  const low = Math.floor(Math.min(open, close) * (0.93 + Math.random() * 0.04));
  return {
    date: `Mar ${16 + i}`,
    collected: Math.floor(base),
    open,
    close,
    high,
    low,
    // body bottom = min(open,close), body height = abs(close-open)
    bodyBottom: Math.min(open, close),
    bodyHeight: Math.abs(close - open),
    wickLow: low,
    wickHigh: high,
  };
});

const RECENT_TRANSACTIONS = [
  { id: 1, borrower: "Rosario D. Santos", type: "Payment", amount: 3933, date: "Mar 31, 2026", status: "completed", method: "GCash" },
  { id: 2, borrower: "Roberto Garcia", type: "Payment", amount: 9417, date: "Mar 31, 2026", status: "completed", method: "Cash" },
  { id: 3, borrower: "Ana Santos", type: "Loan Release", amount: 15000, date: "Mar 30, 2026", status: "released", method: "Bank Transfer" },
  { id: 4, borrower: "Eduardo Mendoza", type: "Payment", amount: 4708, date: "Mar 30, 2026", status: "completed", method: "Bank Transfer" },
  { id: 5, borrower: "Maria L. Reyes", type: "Payment", amount: 958, date: "Mar 29, 2026", status: "completed", method: "Maya" },
  { id: 6, borrower: "Carmen Torres", type: "Loan Release", amount: 50000, date: "Mar 29, 2026", status: "released", method: "Bank Transfer" },
  { id: 7, borrower: "Danilo Villanueva", type: "Payment", amount: 8667, date: "Mar 28, 2026", status: "overdue", method: "Cash" },
];

const RECENT_ACTIVITY = [
  { type: "released", title: "Loan Released", detail: "LA-20260005 — ₱50,000 to Eduardo Mendoza", time: "9:42 AM", href: "/loans/5" },
  { type: "payment", title: "Payment Received", detail: "₱3,933 from Rosario Santos — GCash", time: "9:15 AM", href: "/payments/history" },
  { type: "new", title: "New Borrower", detail: "Ana Santos registered as active borrower", time: "8:30 AM", href: "/borrowers" },
  { type: "approved", title: "Loan Approved", detail: "LA-20260007 — ₱15,000 for Ana Santos", time: "Yesterday", href: "/loans/7" },
  { type: "overdue", title: "Overdue Notice", detail: "Danilo Villanueva — 30 days past due", time: "Yesterday", href: "/collections" },
  { type: "payment", title: "Payment Received", detail: "₱9,417 from Roberto Garcia — Cash", time: "Yesterday", href: "/payments/history" },
  { type: "released", title: "Loan Released", detail: "LA-20260008 — ₱20,000 to Maria Reyes", time: "Mar 29", href: "/loans/8" },
  { type: "completed", title: "Loan Completed", detail: "LA-20260001 — Rosario Santos fully paid", time: "Mar 29", href: "/loans/1" },
] as const;

// ---------------------------------------------------------------------------
// Color maps
// ---------------------------------------------------------------------------

const TRANSACTION_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  completed: { bg: "bg-green-100", text: "text-green-700", label: "Completed" },
  released: { bg: "bg-purple-100", text: "text-purple-700", label: "Released" },
  overdue: { bg: "bg-red-100", text: "text-red-700", label: "Overdue" },
};

const ACTIVITY_DOT: Record<string, string> = {
  released: "bg-brand-orange",
  payment: "bg-green-500",
  new: "bg-brand-blue",
  approved: "bg-brand-orange",
  overdue: "bg-red-500",
  completed: "bg-green-500",
};

// Avatar background colors keyed by first letter bucket
const AVATAR_COLORS: Record<string, string> = {
  A: "bg-purple-200 text-purple-800",
  B: "bg-blue-200 text-blue-800",
  C: "bg-orange-200 text-orange-800",
  D: "bg-green-200 text-green-800",
  E: "bg-teal-200 text-teal-800",
  M: "bg-pink-200 text-pink-800",
  R: "bg-indigo-200 text-indigo-800",
  default: "bg-gray-200 text-gray-700",
};

function getAvatarColor(name: string) {
  const first = name.charAt(0).toUpperCase();
  return AVATAR_COLORS[first] ?? AVATAR_COLORS.default;
}

function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// Sparkline component
// ---------------------------------------------------------------------------

type SparklineColor = "purple" | "orange" | "green" | "blue";

const SPARKLINE_HEX: Record<SparklineColor, string> = {
  purple: "#8b5cf6",
  orange: "#f97316",
  green: "#22c55e",
  blue: "#3b82f6",
};

function Sparkline({ data, color }: { data: { v: number }[]; color: SparklineColor }) {
  const hex = SPARKLINE_HEX[color];
  const gradId = `gradient-${color}`;

  return (
    <div style={{ width: 80, height: 40 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={hex} stopOpacity={0.4} />
              <stop offset="95%" stopColor={hex} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={hex}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom candlestick bar shape
// ---------------------------------------------------------------------------

interface CandlestickBarProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number;
  payload?: {
    bodyBottom: number;
    bodyHeight: number;
    wickLow: number;
    wickHigh: number;
    collected: number;
  };
  // recharts also passes yAxis scale info via these
  background?: { y: number; height: number };
}

function CandlestickBar(props: CandlestickBarProps) {
  const { x = 0, width = 0, payload, background } = props;

  if (!payload || !background) return null;

  const chartBottom = background.y + background.height;
  const chartTop = background.y;
  const chartHeight = background.height;
  const maxVal = payload.wickHigh;
  const minVal = payload.wickLow;

  // Scale value -> pixel y (top-down)
  function toY(val: number) {
    // We need to map relative to the chart range.
    // Use a fixed domain for the whole chart for consistency.
    // We'll derive from the background rect proportionally using a global max.
    // Since we don't have direct scale access, use a rough approach:
    // find max/min across all data as constants.
    const DOMAIN_MIN = 25000;
    const DOMAIN_MAX = 80000;
    const ratio = (val - DOMAIN_MIN) / (DOMAIN_MAX - DOMAIN_MIN);
    return chartBottom - ratio * chartHeight;
  }

  const wickX = x + width / 2;
  const wickTop = toY(payload.wickHigh);
  const wickBottom = toY(payload.wickLow);

  const bodyTop = toY(Math.max(payload.bodyBottom + payload.bodyHeight, payload.bodyBottom));
  const bodyBottom2 = toY(payload.bodyBottom);
  const bodyH = Math.abs(bodyBottom2 - bodyTop);

  const isAbove = payload.collected >= TARGET;
  const fill = isAbove ? "#22c55e" : "#f43f5e";
  const wickWidth = 1.5;
  const bodyWidth = Math.max(width * 0.55, 6);

  return (
    <g>
      {/* Wick (thin vertical line) */}
      <line
        x1={wickX}
        y1={Math.min(wickTop, chartTop)}
        x2={wickX}
        y2={Math.max(wickBottom, chartTop)}
        stroke={fill}
        strokeWidth={wickWidth}
        opacity={0.7}
      />
      {/* Body (wider rectangle) */}
      <rect
        x={x + (width - bodyWidth) / 2}
        y={Math.max(bodyTop, chartTop)}
        width={bodyWidth}
        height={Math.max(bodyH, 3)}
        fill={fill}
        rx={2}
        ry={2}
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Custom bar chart tooltip
// ---------------------------------------------------------------------------

function CollectionTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; payload: typeof CHART_DATA[0] }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isAboveTarget = d.collected >= TARGET;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-medium mb-1">{label}</p>
      <p className={isAboveTarget ? "text-[#22c55e] font-semibold" : "text-[#f43f5e] font-semibold"}>
        {phpFormat.format(d.collected)}
      </p>
      <p className="text-muted-foreground mt-0.5">H: {phpFormat.format(d.high)} / L: {phpFormat.format(d.low)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const TIME_PERIODS = ["1W", "1M", "3M", "6M", "1Y"] as const;

export default function DashboardPage() {
  const { user } = useAuth();
  const greeting = useMemo(() => getGreeting(), []);
  const formattedDate = useMemo(() => getFormattedDate(), []);
  const [activePeriod, setActivePeriod] = useState<(typeof TIME_PERIODS)[number]>("1M");

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Section 1: Slim welcome header                                     */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}, {user?.full_name ?? "Admin"}
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">{formattedDate}</span>
          <span className="inline-flex items-center rounded-full bg-purple-100 text-purple-700 px-3 py-1 text-xs font-medium">
            23 payments due today
          </span>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Section 2: KPI Cards with sparklines                              */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Portfolio */}
        <Link href="/loans">
          <Card className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="py-4 px-4">
              <div className="flex items-start justify-between mb-3">
                <div className="rounded-full bg-purple-100 p-2">
                  <Wallet className="h-4 w-4 text-purple-600" />
                </div>
                <Sparkline data={SPARKLINE_PURPLE} color="purple" />
              </div>
              <p className="text-2xl font-bold">₱15.2M</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total Portfolio{" "}
                <span className="text-green-600 font-medium">+12%</span>
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Active Loans */}
        <Link href="/loans">
          <Card className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="py-4 px-4">
              <div className="flex items-start justify-between mb-3">
                <div className="rounded-full bg-orange-100 p-2">
                  <FileText className="h-4 w-4 text-orange-600" />
                </div>
                <Sparkline data={SPARKLINE_ORANGE} color="orange" />
              </div>
              <p className="text-2xl font-bold">843</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Active Loans{" "}
                <span className="text-green-600 font-medium">+5%</span>
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Collected This Month */}
        <Link href="/payments/history">
          <Card className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="py-4 px-4">
              <div className="flex items-start justify-between mb-3">
                <div className="rounded-full bg-green-100 p-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
                <Sparkline data={SPARKLINE_GREEN} color="green" />
              </div>
              <p className="text-2xl font-bold">₱2.4M</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Collected This Month{" "}
                <span className="text-green-600 font-medium">+18%</span>
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Overdue Accounts */}
        <Link href="/collections">
          <Card className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="py-4 px-4">
              <div className="flex items-start justify-between mb-3">
                <div className="rounded-full bg-blue-100 p-2">
                  <AlertTriangle className="h-4 w-4 text-blue-600" />
                </div>
                <Sparkline data={SPARKLINE_BLUE} color="blue" />
              </div>
              <p className="text-2xl font-bold text-destructive">47</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Overdue Accounts{" "}
                <span className="text-red-600 font-medium">+3</span>
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Section 3: Main Chart Card                                         */}
      {/* ----------------------------------------------------------------- */}
      <Card className="rounded-xl border bg-card shadow-sm" style={{ minHeight: 400 }}>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base font-semibold">Collection Overview</CardTitle>
            <div className="flex items-center gap-1">
              {TIME_PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setActivePeriod(p)}
                  className={
                    activePeriod === p
                      ? "bg-purple-600 text-white rounded-md px-3 py-1 text-xs font-medium"
                      : "rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-purple-50 transition-colors"
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        {/* Big value display */}
        <div className="px-6 pb-4">
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold tracking-tight">₱2,456,890</span>
            <span className="text-sm font-medium text-green-600">+12.5%</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Total collections this month
          </p>
        </div>

        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={CHART_DATA} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[25000, 80000]}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `₱${(v / 1000).toFixed(0)}k` : `₱${v}`
                }
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip content={<CollectionTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
              <Bar
                dataKey="collected"
                maxBarSize={28}
                shape={<CandlestickBar />}
              >
                {CHART_DATA.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.collected >= TARGET ? "#22c55e" : "#f43f5e"}
                  />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Section 4: Quick Actions                                           */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            href: "/loans/new",
            icon: FilePlus,
            iconBg: "bg-purple-100",
            iconColor: "text-purple-600",
            title: "New Loan",
            description: "Create a new loan application",
          },
          {
            href: "/payments",
            icon: CreditCard,
            iconBg: "bg-blue-100",
            iconColor: "text-blue-600",
            title: "Record Payment",
            description: "Post a borrower payment",
          },
          {
            href: "/collections",
            icon: ClipboardList,
            iconBg: "bg-green-100",
            iconColor: "text-green-600",
            title: "View Collections",
            description: "Check today's collections",
          },
        ].map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="rounded-xl border bg-card shadow-sm hover:border-purple-400 hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 py-4">
                <div className={`rounded-full p-2.5 ${action.iconBg}`}>
                  <action.icon className={`h-5 w-5 ${action.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{action.title}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Section 5: Two-column bottom layout                                */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Recent Transactions */}
        <div className="lg:col-span-2">
          <Card className="rounded-xl border bg-card shadow-sm h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
                <Link
                  href="/payments/history"
                  className="text-xs font-medium text-purple-600 hover:underline"
                >
                  View all →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Borrower</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell pr-6">Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RECENT_TRANSACTIONS.map((tx) => {
                    const statusStyle = TRANSACTION_STATUS[tx.status] ?? TRANSACTION_STATUS.completed;
                    const initials = getInitials(tx.borrower);
                    const avatarColor = getAvatarColor(tx.borrower);
                    return (
                      <TableRow key={tx.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarColor}`}
                            >
                              {initials}
                            </div>
                            <span className="font-medium text-sm whitespace-nowrap">{tx.borrower}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{tx.type}</TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          ₱{tx.amount.toLocaleString("en-PH")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                          {tx.date}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                          >
                            {statusStyle.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden md:table-cell pr-6">
                          {tx.method}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right: Recent Activity */}
        <div>
          <Card className="rounded-xl border bg-card shadow-sm h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 px-0 pb-0">
              <div>
                {RECENT_ACTIVITY.map((item, i) => (
                  <Link
                    key={i}
                    href={item.href}
                    className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-muted/50 transition-colors"
                  >
                    <div className="mt-1.5 shrink-0">
                      <div
                        className={`h-2 w-2 rounded-full ${ACTIVITY_DOT[item.type] ?? "bg-muted-foreground"}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {item.detail}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground shrink-0 mt-0.5">
                      {item.time}
                    </p>
                  </Link>
                ))}
              </div>
            </CardContent>
            <div className="border-t px-4 py-3">
              <Link
                href="/audit-trail"
                className="flex items-center justify-center gap-1 text-sm font-medium text-purple-600 hover:underline"
              >
                View All →
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
