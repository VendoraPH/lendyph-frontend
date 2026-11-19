"use client";

import { Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { ExecutiveFilterKey, ExecutiveTrends } from "@/types/executive-dashboard";
import type { EndpointSource } from "../../_hooks/use-executive-endpoints";
import { figureFilterNote, trendSeries, type TrendPoint } from "../../_lib/executive-books";
import { EXECUTIVE_LAYOUT as L } from "../../_lib/executive-layout";
import { hasActivity } from "../../_lib/executive-sections";
import { compactPeso, formatMetric } from "../../_lib/metrics";
import { SectionShell, SourceGate } from "./section-shell";

const lendingConfig = {
  principal_released: { label: "Principal released", color: "var(--chart-2)" },
  principal_collected: { label: "Principal collected", color: "var(--chart-1)" },
} satisfies ChartConfig;

const cashConfig = {
  // One blue, one orange and a dark blue line: no two series share a look.
  cash_in: { label: "Cash in", color: "var(--chart-1)" },
  cash_out: { label: "Cash out", color: "var(--chart-2)" },
  net_cash: { label: "Net cash", color: "var(--chart-3)" },
} satisfies ChartConfig;

const membersConfig = { new_members: { label: "New members", color: "var(--chart-3)" } } satisfies ChartConfig;

type Key = keyof typeof lendingConfig | keyof typeof cashConfig | keyof typeof membersConfig;

function label(name: unknown): string {
  return ({ ...lendingConfig, ...cashConfig, ...membersConfig } as Record<string, { label: string }>)[String(name)]?.label ?? String(name);
}

/** The chart's figures as a table, for screen readers. */
function ChartTable({ caption, points, keys, count = false }: { caption: string; points: TrendPoint[]; keys: Key[]; count?: boolean }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Month</th>
          {keys.map((k) => (
            <th key={k} scope="col">
              {label(k)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.month}>
            <th scope="row">{p.label}</th>
            {keys.map((k) => (
              <td key={k}>{count ? formatMetric(p[k], "count") : formatCurrency(p[k])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Notes({ notes }: { notes: (string | null)[] }) {
  const shown = [...new Set(notes.filter((n): n is string => n !== null))];
  return shown.length ? <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">{shown.join(" ")}</p> : null;
}

/**
 * Trends by month, from `GET /dashboard/executive/trends`: principal released
 * against collected (Chart B), cash in and out (Chart I) and new members
 * (Chart L), each month Cash Flow's and the Member Report's own figures.
 */
export function TrendsSection({ source, sentFilters }: { source: EndpointSource<ExecutiveTrends>; sentFilters: ExecutiveFilterKey[] }) {
  const response = source.state === "ready" ? source.data : null;
  const points = response ? trendSeries(response.months) : [];
  const note = (figure: string) => (response ? figureFilterNote(sentFilters, response, figure) : null);

  return (
    <SectionShell title="Trends" icon={<TrendingUp className="size-4" />} note="Each month is the Cash Flow report's and the Member Report's own figure for that month.">
      {source.state === "refused" ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground" role="alert">
          {source.message}
        </p>
      ) : (
        <div className="space-y-4">
          <div className={L.twoUp}>
            <div className={L.cell}>
              <h3 className="mb-2 text-sm font-medium">Principal released vs collected</h3>
              <SourceGate source={source} empty={!hasActivity(points, ["principal_released", "principal_collected"])}>
                <ChartContainer config={lendingConfig} className="h-[220px] w-full min-w-0" aria-hidden="true">
                  <BarChart data={points} margin={{ left: 4, right: 4 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} width={56} fontSize={11} tickFormatter={(v) => compactPeso(Number(v))} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(v, name) => `${label(name)}: ${formatCurrency(Number(v))}`} />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="principal_released" fill="var(--color-principal_released)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="principal_collected" fill="var(--color-principal_collected)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ChartContainer>
                <ChartTable caption="Principal released and collected by month" points={points} keys={["principal_released", "principal_collected"]} />
                <Notes notes={[note("principal_released"), note("principal_collected")]} />
              </SourceGate>
            </div>
            <div className={L.cell}>
              <h3 className="mb-2 text-sm font-medium">Cash in and out</h3>
              <SourceGate source={source} empty={!hasActivity(points, ["cash_in", "cash_out", "net_cash"])}>
                <ChartContainer config={cashConfig} className="h-[220px] w-full min-w-0" aria-hidden="true">
                  <ComposedChart data={points} margin={{ left: 4, right: 4 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} width={56} fontSize={11} tickFormatter={(v) => compactPeso(Number(v))} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(v, name) => `${label(name)}: ${formatCurrency(Number(v))}`} />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="cash_in" fill="var(--color-cash_in)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="cash_out" fill="var(--color-cash_out)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Line dataKey="net_cash" stroke="var(--color-net_cash)" strokeWidth={2.5} strokeDasharray="5 3" dot={{ r: 2.5 }} isAnimationActive={false} />
                  </ComposedChart>
                </ChartContainer>
                <ChartTable caption="Cash in, out and net by month" points={points} keys={["cash_in", "cash_out", "net_cash"]} />
                <Notes notes={[note("cash_in"), note("cash_out"), note("net_cash")]} />
              </SourceGate>
            </div>
          </div>
          <div className={L.cell}>
            <h3 className="mb-2 text-sm font-medium">New members</h3>
            <SourceGate source={source} empty={!hasActivity(points, ["new_members"])} height="h-40">
              <ChartContainer config={membersConfig} className="h-[160px] w-full min-w-0" aria-hidden="true">
                <BarChart data={points} margin={{ left: 4, right: 4 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} width={40} fontSize={11} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v, name) => `${label(name)}: ${formatMetric(Number(v), "count")}`} />} />
                  <Bar dataKey="new_members" fill="var(--color-new_members)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ChartContainer>
              <ChartTable caption="New members by month" points={points} keys={["new_members"]} count />
              <Notes notes={[note("new_members")]} />
            </SourceGate>
          </div>
        </div>
      )}
    </SectionShell>
  );
}
