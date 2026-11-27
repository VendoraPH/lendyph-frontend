"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatDate } from "@/lib/format";
import type { OriginationDashboard } from "@/types/loan-origination";
import { stageChartRows, statusChartRows } from "../../_lib/dashboard-view";

const TREND = {
  completed: { label: "Completed", color: "var(--chart-2)" },
  incomplete: { label: "Incomplete", color: "var(--chart-4)" },
} satisfies ChartConfig;
const DECISIONS = {
  approved: { label: "Approved", color: "var(--chart-2)" },
  rejected: { label: "Rejected", color: "var(--chart-5)" },
} satisfies ChartConfig;
const COUNT = { count: { label: "Applications", color: "var(--chart-1)" } } satisfies ChartConfig;
const HOURS = { avg_hours: { label: "Average hours", color: "var(--chart-3)" } } satisfies ChartConfig;

function ChartCard({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? <p className="py-10 text-center text-sm text-muted-foreground">No data for this period.</p> : children}
      </CardContent>
    </Card>
  );
}

const shortDate = (v: string) => formatDate(v);

/**
 * A category label drawn on one line. Recharts' own tick wraps a label to the
 * axis width in separate pieces, which then read with their words run
 * together ("Under DocumentVerification").
 */
function CategoryTick({ x, y, payload }: { x?: number | string; y?: number | string; payload?: { value?: unknown } }) {
  return (
    <text x={x} y={y} dy="0.32em" textAnchor="end" fontSize={11} className="fill-muted-foreground">
      {String(payload?.value ?? "")}
    </text>
  );
}

/**
 * The dashboard's five charts. Every figure is the server's, nothing is summed
 * here, and every status reads in the module's words.
 */
export function OriginationCharts({ data }: { data: OriginationDashboard }) {
  const byStatus = statusChartRows(data.by_status);
  const stages = stageChartRows(data.stage_times);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Completed and incomplete applications" empty={data.trends.length === 0}>
        <ChartContainer config={TREND} className="aspect-auto h-[220px] w-full">
          <LineChart data={data.trends} margin={{ left: 4, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={shortDate} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line dataKey="completed" stroke="var(--color-completed)" strokeWidth={2} dot={false} />
            <Line dataKey="incomplete" stroke="var(--color-incomplete)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
      </ChartCard>
      <ChartCard title="Approved and rejected" empty={data.decisions.length === 0}>
        <ChartContainer config={DECISIONS} className="aspect-auto h-[220px] w-full">
          <BarChart data={data.decisions} margin={{ left: 4, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={shortDate} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="approved" fill="var(--color-approved)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="rejected" fill="var(--color-rejected)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </ChartCard>
      <ChartCard title="Applications by status" empty={byStatus.length === 0}>
        <ChartContainer config={COUNT} className="aspect-auto h-[260px] w-full">
          <BarChart data={byStatus} layout="vertical" margin={{ left: 8, right: 8 }}>
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={190} interval={0} tick={<CategoryTick />} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ChartContainer>
      </ChartCard>
      <ChartCard title="Applications by loan product" empty={data.by_product.length === 0}>
        <ChartContainer config={COUNT} className="aspect-auto h-[260px] w-full">
          <BarChart data={data.by_product} layout="vertical" margin={{ left: 8, right: 8 }}>
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis type="category" dataKey="product" tickLine={false} axisLine={false} width={150} interval={0} tick={<CategoryTick />} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ChartContainer>
      </ChartCard>
      <ChartCard title="Average time in each stage (hours)" empty={stages.length === 0}>
        <ChartContainer config={HOURS} className="aspect-auto h-[240px] w-full">
          <BarChart data={stages} layout="vertical" margin={{ left: 8, right: 8 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={190} interval={0} tick={<CategoryTick />} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="avg_hours" fill="var(--color-avg_hours)" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ChartContainer>
      </ChartCard>
    </div>
  );
}
