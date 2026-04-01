"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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

const SPARKLINE_ORANGE = [
  { v: 120 }, { v: 135 }, { v: 128 }, { v: 145 }, { v: 152 }, { v: 148 }, { v: 160 },
];
const SPARKLINE_GREEN = [
  { v: 800 }, { v: 810 }, { v: 820 }, { v: 815 }, { v: 830 }, { v: 838 }, { v: 843 },
];
const SPARKLINE_BLUE = [
  { v: 180 }, { v: 195 }, { v: 210 }, { v: 205 }, { v: 220 }, { v: 235 }, { v: 240 },
];
const SPARKLINE_RED = [
  { v: 40 }, { v: 42 }, { v: 41 }, { v: 43 }, { v: 44 }, { v: 46 }, { v: 47 },
];

const CHART_DATA = Array.from({ length: 15 }, (_, i) => ({
  date: `Mar ${16 + i}`,
  collected: Math.floor(35000 + (((i * 7 + 3) % 10) / 10) * 30000),
}));

const ATTENTION_LOANS = [
  { id: 2, app_number: "LA-20260002", borrower: "Roberto Garcia", amount: 100000, status: "for_review" },
  { id: 4, app_number: "LA-20260004", borrower: "Eduardo Mendoza", amount: 50000, status: "for_review" },
  { id: 3, app_number: "LA-20260003", borrower: "Maria L. Reyes", amount: 30000, status: "approved" },
  { id: 7, app_number: "LA-20260007", borrower: "Ana Santos", amount: 15000, status: "approved" },
  { id: 9, app_number: "LA-20260009", borrower: "Danilo Villanueva", amount: 80000, status: "defaulted" },
  { id: 11, app_number: "LA-20260011", borrower: "Carmen Torres", amount: 5000, status: "defaulted" },
] as const;

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

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  for_review: { bg: "bg-amber-100", text: "text-amber-700", label: "For Review" },
  approved: { bg: "bg-blue-100", text: "text-blue-700", label: "Approved" },
  defaulted: { bg: "bg-red-100", text: "text-red-700", label: "Defaulted" },
};

const ACTION_STYLES: Record<string, { className: string; label: string }> = {
  for_review: { className: "bg-amber-100 text-amber-700 hover:bg-amber-200", label: "Review" },
  approved: { className: "bg-blue-100 text-blue-700 hover:bg-blue-200", label: "Release" },
  defaulted: { className: "bg-red-100 text-red-700 hover:bg-red-200", label: "Follow Up" },
};

const ACTIVITY_DOT: Record<string, string> = {
  released: "bg-brand-orange",
  payment: "bg-green-500",
  new: "bg-brand-blue",
  approved: "bg-brand-orange",
  overdue: "bg-red-500",
  completed: "bg-green-500",
};

// ---------------------------------------------------------------------------
// Sparkline component
// ---------------------------------------------------------------------------

type SparklineColor = "orange" | "green" | "blue" | "red";

const SPARKLINE_HEX: Record<SparklineColor, string> = {
  orange: "#f97316",
  green: "#22c55e",
  blue: "#3b82f6",
  red: "#ef4444",
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
// Custom bar chart tooltip
// ---------------------------------------------------------------------------

function CollectionTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-medium mb-1">{label}</p>
      <p className="text-[#f97316] font-semibold">{phpFormat.format(payload[0].value)}</p>
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
          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-xs font-medium">
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
                <div className="rounded-full bg-orange-100 p-2">
                  <Wallet className="h-4 w-4 text-orange-500" />
                </div>
                <Sparkline data={SPARKLINE_ORANGE} color="orange" />
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
                <div className="rounded-full bg-green-100 p-2">
                  <FileText className="h-4 w-4 text-green-600" />
                </div>
                <Sparkline data={SPARKLINE_GREEN} color="green" />
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
                <div className="rounded-full bg-blue-100 p-2">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </div>
                <Sparkline data={SPARKLINE_BLUE} color="blue" />
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
                <div className="rounded-full bg-red-100 p-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </div>
                <Sparkline data={SPARKLINE_RED} color="red" />
              </div>
              <p className="text-2xl font-bold text-destructive">47</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Overdue Accounts{" "}
                <span className="text-destructive font-medium">+3</span>
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Section 3: Main Chart Card                                         */}
      {/* ----------------------------------------------------------------- */}
      <Card className="rounded-xl border bg-card shadow-sm" style={{ minHeight: 350 }}>
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
                      ? "bg-brand-orange text-white rounded-md px-3 py-1 text-xs font-medium"
                      : "rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={CHART_DATA} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
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
                fill="#f97316"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
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
            iconBg: "bg-orange-100",
            iconColor: "text-orange-500",
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
            <Card className="rounded-xl border bg-card shadow-sm hover:border-brand-orange hover:shadow-md transition-all cursor-pointer h-full">
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
        {/* Left: Loans Needing Attention */}
        <div className="lg:col-span-2">
          <Card className="rounded-xl border bg-card shadow-sm h-full">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Loans Needing Attention</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan #</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ATTENTION_LOANS.map((loan) => {
                    const statusStyle = STATUS_COLORS[loan.status];
                    const actionStyle = ACTION_STYLES[loan.status];
                    return (
                      <TableRow key={loan.id}>
                        <TableCell className="font-medium text-xs">{loan.app_number}</TableCell>
                        <TableCell className="text-sm">{loan.borrower}</TableCell>
                        <TableCell className="text-right text-sm">
                          {phpFormat.format(loan.amount)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                          >
                            {statusStyle.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/loans/${loan.id}`}>
                            <Button size="xs" className={actionStyle.className}>
                              {actionStyle.label}
                            </Button>
                          </Link>
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
                className="flex items-center justify-center gap-1 text-sm font-medium text-brand-orange hover:underline"
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
