"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
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
import { Wallet, FileText, DollarSign, AlertTriangle } from "lucide-react";

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

// Daily collections bar chart data (green = positive change, red = negative)
const DAILY_COLLECTIONS = [
  { date: "Mar 12", collected: 42000, prev: 38000 },
  { date: "Mar 13", collected: 38000, prev: 42000 },
  { date: "Mar 14", collected: 55000, prev: 38000 },
  { date: "Mar 15", collected: 48000, prev: 55000 },
  { date: "Mar 16", collected: 62000, prev: 48000 },
  { date: "Mar 17", collected: 35000, prev: 62000 },
  { date: "Mar 18", collected: 41000, prev: 35000 },
  { date: "Mar 19", collected: 58000, prev: 41000 },
  { date: "Mar 20", collected: 52000, prev: 58000 },
  { date: "Mar 21", collected: 67000, prev: 52000 },
  { date: "Mar 22", collected: 45000, prev: 67000 },
  { date: "Mar 23", collected: 71000, prev: 45000 },
  { date: "Mar 24", collected: 63000, prev: 71000 },
  { date: "Mar 25", collected: 58000, prev: 63000 },
  { date: "Mar 26", collected: 74000, prev: 58000 },
  { date: "Mar 27", collected: 49000, prev: 74000 },
  { date: "Mar 28", collected: 82000, prev: 49000 },
  { date: "Mar 29", collected: 68000, prev: 82000 },
  { date: "Mar 30", collected: 76000, prev: 68000 },
  { date: "Mar 31", collected: 85000, prev: 76000 },
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
    color: "#8b5cf6",
    bgColor: "bg-purple-100",
    iconColor: "text-purple-600",
    borderClass: "border-t-2 border-t-purple-500",
    sparkData: SPARKLINE_PURPLE,
  },
  {
    icon: FileText,
    value: "843",
    label: "Active Loans",
    color: "#f97316",
    bgColor: "bg-orange-100",
    iconColor: "text-orange-600",
    borderClass: "border-t-2 border-t-orange-500",
    sparkData: SPARKLINE_ORANGE,
  },
  {
    icon: DollarSign,
    value: "₱2.4M",
    label: "Collected",
    color: "#22c55e",
    bgColor: "bg-green-100",
    iconColor: "text-green-600",
    borderClass: "border-t-2 border-t-green-500",
    sparkData: SPARKLINE_GREEN,
  },
  {
    icon: AlertTriangle,
    value: "47",
    label: "Overdue",
    color: "#3b82f6",
    bgColor: "bg-blue-100",
    iconColor: "text-blue-600",
    borderClass: "border-t-2 border-t-blue-500",
    sparkData: SPARKLINE_BLUE,
  },
];

// ---------------------------------------------------------------------------
// Sparkline component
// ---------------------------------------------------------------------------

function Sparkline({ data, color }: { data: { v: number }[]; color: string }) {
  const gradId = `spark-${color.replace("#", "")}`;
  return (
    <div style={{ width: 80, height: 40 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
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
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip for daily bar chart
// ---------------------------------------------------------------------------

function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; payload: (typeof DAILY_COLLECTIONS)[0] }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isUp = d.collected >= d.prev;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-medium mb-1">{label}</p>
      <p className={isUp ? "text-[#22c55e] font-semibold" : "text-[#f43f5e] font-semibold"}>
        ₱{d.collected.toLocaleString("en-PH")}
      </p>
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

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Row 1: KPI Cards                                                  */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map((kpi) => (
          <Card key={kpi.label} className={`rounded-xl border shadow-sm ${kpi.borderClass}`}>
            <CardContent className="py-5 px-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-full ${kpi.bgColor} p-2`}>
                    <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold leading-tight">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  </div>
                </div>
                <Sparkline data={kpi.sparkData} color={kpi.color} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Row 2: Main Chart Card — Left summary + Right bar chart           */}
      {/* ----------------------------------------------------------------- */}
      <Card className="rounded-xl border shadow-sm overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          {/* Left: value + mini area chart */}
          <div className="p-6 lg:w-2/5 flex flex-col justify-between">
            <div>
              <p className="text-4xl font-bold tracking-tight">₱2,456,890</p>
              <p className="text-sm text-muted-foreground mt-1">Total Collections</p>
              <p className="text-sm font-medium text-green-600 mt-0.5">+12.5%</p>
            </div>

            {/* Time period toggles */}
            <div className="flex items-center gap-1 mt-4">
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

            {/* Mini area chart */}
            <div className="mt-4" style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={COLLECTIONS_TREND} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                  <defs>
                    <linearGradient id="collectionsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#collectionsGrad)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: daily collections bar chart */}
          <div className="p-6 lg:w-3/5 border-t lg:border-t-0 lg:border-l border-border/50">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={DAILY_COLLECTIONS} margin={{ top: 8, right: 8, bottom: 4, left: 8 }} barGap={4}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={2}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
                <Bar dataKey="collected" radius={[3, 3, 0, 0]} maxBarSize={14}>
                  {DAILY_COLLECTIONS.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.collected >= entry.prev ? "#22c55e" : "#f43f5e"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Row 3: Recent Transactions Table                                   */}
      {/* ----------------------------------------------------------------- */}
      <Card className="rounded-xl border shadow-sm">
        <div className="px-6 pt-5 pb-3">
          <h3 className="text-base font-semibold">Recent Transactions</h3>
        </div>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-purple-50/50">
                  <TableHead className="pl-6 text-purple-900/70">Name</TableHead>
                  <TableHead className="text-purple-900/70">Description</TableHead>
                  <TableHead className="text-right text-purple-900/70">Amount</TableHead>
                  <TableHead className="pr-6 text-right text-purple-900/70">Date</TableHead>
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
  );
}
