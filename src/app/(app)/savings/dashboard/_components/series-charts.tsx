"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { SavingsDashboardMonth } from "@/types/savings-insight";
import { compactPesoAxis, seriesPoints, type SeriesPoint } from "../_lib/dashboard-view";

const GROWTH_CONFIG = {
  savings_balance: { label: "Savings", color: "var(--chart-1)" },
  time_deposits: { label: "Time deposits", color: "var(--chart-2)" },
} satisfies ChartConfig;

const FLOW_CONFIG = {
  deposits: { label: "Deposits", color: "var(--chart-1)" },
  withdrawals: { label: "Withdrawals", color: "var(--chart-3)" },
} satisfies ChartConfig;

type SeriesKey = keyof SeriesPoint["text"];
const LABELS: Record<SeriesKey, string> = {
  savings_balance: "Savings",
  time_deposits: "Time deposits",
  total_deposits: "Total deposits",
  deposits: "Deposits",
  withdrawals: "Withdrawals",
  net_movement: "Net movement",
};

/** The tooltip shows the server's figure to the centavo, read from the point itself. */
function tooltip(keys: SeriesKey[]) {
  return (
    <ChartTooltip
      content={
        <ChartTooltipContent
          labelFormatter={(_: unknown, payload: ReadonlyArray<{ payload?: SeriesPoint }>) => payload[0]?.payload?.label ?? ""}
          formatter={(_value, name, item) => {
            const point = (item as { payload?: SeriesPoint }).payload;
            const key = name as SeriesKey;
            return (
              <div className="flex w-full items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} aria-hidden="true" />
                <span className="flex-1 text-muted-foreground">{LABELS[key] ?? String(name)}</span>
                <span className="font-mono font-medium tabular-nums text-foreground">{point?.text[key] ?? "—"}</span>
              </div>
            );
          }}
        />
      }
      itemSorter={(entry) => keys.indexOf(entry.dataKey as SeriesKey)}
    />
  );
}

const AXES = (
  <>
    <CartesianGrid vertical={false} />
    <XAxis dataKey="tick" tickLine={false} axisLine={false} tickMargin={8} />
    <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(value: number) => compactPesoAxis(value)} />
  </>
);

/** The same figures as a table, for screen readers. */
function ScreenReaderTable({ caption, points, keys }: { caption: string; points: SeriesPoint[]; keys: SeriesKey[] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Month</th>
          {keys.map((key) => (
            <th key={key} scope="col">
              {LABELS[key]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.month}>
            <th scope="row">{p.label}</th>
            {keys.map((key) => (
              <td key={key}>{p.text[key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Deposit growth and deposits against withdrawals, month by month (up to 12, ending with the period's month). */
export function SeriesCharts({ series }: { series: readonly SavingsDashboardMonth[] | undefined }) {
  const points = seriesPoints(series);
  if (points.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No savings records yet for this selection.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deposit growth</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={GROWTH_CONFIG} className="aspect-auto h-[260px] w-full" aria-hidden="true">
            <BarChart data={points} margin={{ left: 4, right: 8 }}>
              {AXES}
              {tooltip(["savings_balance", "time_deposits"])}
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="savings_balance" stackId="total" fill="var(--color-savings_balance)" />
              <Bar dataKey="time_deposits" stackId="total" fill="var(--color-time_deposits)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
          <ScreenReaderTable
            caption="Savings and time deposits at each month end"
            points={points}
            keys={["savings_balance", "time_deposits", "total_deposits"]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deposits and withdrawals</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={FLOW_CONFIG} className="aspect-auto h-[260px] w-full" aria-hidden="true">
            <BarChart data={points} margin={{ left: 4, right: 8 }}>
              {AXES}
              {tooltip(["deposits", "withdrawals"])}
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="deposits" fill="var(--color-deposits)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="withdrawals" fill="var(--color-withdrawals)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
          <ScreenReaderTable
            caption="Deposits, withdrawals and net movement by month"
            points={points}
            keys={["deposits", "withdrawals", "net_movement"]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
