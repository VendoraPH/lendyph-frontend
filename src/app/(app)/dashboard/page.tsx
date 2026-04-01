"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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

// Candlestick data — open/close/high/low per day (like the reference screenshot)
const CANDLESTICK_DATA = [
  { date: "12", open: 42, close: 48, high: 52, low: 38 },
  { date: "13", open: 48, close: 38, high: 50, low: 35 },
  { date: "14", open: 38, close: 55, high: 58, low: 36 },
  { date: "15", open: 55, close: 48, high: 57, low: 45 },
  { date: "16", open: 48, close: 62, high: 65, low: 46 },
  { date: "17", open: 62, close: 35, high: 64, low: 32 },
  { date: "18", open: 35, close: 41, high: 44, low: 33 },
  { date: "19", open: 41, close: 58, high: 61, low: 39 },
  { date: "20", open: 58, close: 52, high: 60, low: 49 },
  { date: "21", open: 52, close: 67, high: 70, low: 50 },
  { date: "22", open: 67, close: 45, high: 69, low: 42 },
  { date: "23", open: 45, close: 71, high: 74, low: 43 },
  { date: "24", open: 71, close: 63, high: 73, low: 60 },
  { date: "25", open: 63, close: 58, high: 66, low: 55 },
  { date: "26", open: 58, close: 74, high: 78, low: 56 },
  { date: "27", open: 74, close: 49, high: 76, low: 46 },
  { date: "28", open: 49, close: 82, high: 85, low: 47 },
  { date: "29", open: 82, close: 68, high: 84, low: 65 },
  { date: "30", open: 68, close: 76, high: 80, low: 66 },
  { date: "31", open: 76, close: 85, high: 88, low: 74 },
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
  },
  {
    icon: FileText,
    value: "843",
    label: "Active Loans",
    color: "#e879f9",
    sparkData: SPARKLINE_ORANGE,
  },
  {
    icon: DollarSign,
    value: "₱2.4M",
    label: "Collected",
    color: "#10b981",
    sparkData: SPARKLINE_GREEN,
  },
  {
    icon: AlertTriangle,
    value: "47",
    label: "Overdue",
    color: "#f87171",
    sparkData: SPARKLINE_BLUE,
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
  const bodyWidth = Math.max(width * 0.35, 4);
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
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Row 1: KPI Cards                                                  */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map((kpi) => (
          <Card key={kpi.label} className="rounded-xl border shadow-sm">
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
        ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Row 2: Main Chart Card — full width single column                 */}
      {/* ----------------------------------------------------------------- */}
      <Card className="rounded-xl border shadow-sm overflow-hidden">
        {/* Header: value + time toggles */}
        <div className="flex items-start justify-between p-6 pb-2">
          <div>
            <p className="text-3xl font-bold tracking-tight">₱2,456,890</p>
            <p className="text-sm text-muted-foreground mt-1">Total Collections</p>
            <p className="text-sm font-medium text-green-600 mt-0.5">+12.5%</p>
          </div>
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

        {/* Candlestick chart — full width */}
        <div className="px-4">
          {mounted ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={CANDLESTICK_DATA} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
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
          ) : null}
        </div>

        {/* Purple area chart below — full width */}
        <div className="px-4 pb-4" style={{ height: 80 }}>
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={COLLECTIONS_TREND} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <defs>
                  <linearGradient id="collectionsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.02} />
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
