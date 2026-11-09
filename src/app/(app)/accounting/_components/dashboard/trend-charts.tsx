"use client";

import { Bar, CartesianGrid, ComposedChart, Line, LineChart, XAxis, YAxis } from "recharts";
import type { TooltipValueType } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { DashboardMonth } from "@/types";
import {
  compactPesoTick,
  dashboardChartRows,
  type DashboardChartRow,
} from "../../_lib/dashboard-chart";
import { centavosOrDash } from "../../_lib/dashboard-figures";

const RESULT_CONFIG = {
  income: { label: "Income", color: "var(--chart-1)" },
  expenses: { label: "Expenses", color: "var(--chart-2)" },
  net_income: { label: "Net income", color: "var(--chart-3)" },
} satisfies ChartConfig;

const CASH_CONFIG = {
  cash: { label: "Cash at month end", color: "var(--chart-1)" },
} satisfies ChartConfig;

type SeriesKey = keyof typeof RESULT_CONFIG | keyof typeof CASH_CONFIG;
const SERIES_LABELS: Record<SeriesKey, string> = {
  income: RESULT_CONFIG.income.label,
  expenses: RESULT_CONFIG.expenses.label,
  net_income: RESULT_CONFIG.net_income.label,
  cash: CASH_CONFIG.cash.label,
};

/** The point's month in words, from the row itself (the axis shows "Nov"). */
function tooltipMonth(_: unknown, payload: ReadonlyArray<{ payload?: DashboardChartRow }>) {
  return payload[0]?.payload?.label ?? "";
}

/** One tooltip line: the series and its full figure, ₱ to the centavo. */
function tooltipLine(
  value: TooltipValueType | undefined,
  name: string | number | undefined,
  item: { color?: string },
) {
  const label = SERIES_LABELS[name as SeriesKey] ?? String(name ?? "");
  return (
    <div className="flex w-full items-center gap-2">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: item.color }}
        aria-hidden="true"
      />
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="font-mono font-medium tabular-nums text-foreground">
        {centavosOrDash(typeof value === "number" || typeof value === "string" ? value : null)}
      </span>
    </div>
  );
}

const TOOLTIP = (
  <ChartTooltip
    content={<ChartTooltipContent labelFormatter={tooltipMonth} formatter={tooltipLine} />}
  />
);

const AXES = (
  <>
    <CartesianGrid vertical={false} />
    <XAxis dataKey="tick" tickLine={false} axisLine={false} tickMargin={8} />
    <YAxis
      tickLine={false}
      axisLine={false}
      width={64}
      tickFormatter={(value: number) => compactPesoTick(value)}
    />
  </>
);

/** The same figures as a table, for screen readers. */
function ScreenReaderTable({
  caption,
  rows,
  keys,
}: {
  caption: string;
  rows: DashboardChartRow[];
  keys: SeriesKey[];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Month</th>
          {keys.map((key) => (
            <th key={key} scope="col">
              {SERIES_LABELS[key]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.month}>
            <th scope="row">{row.label}</th>
            {keys.map((key) => (
              <td key={key}>{centavosOrDash(row[key])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TrendCharts({ months }: { months: readonly DashboardMonth[] | undefined }) {
  const rows = dashboardChartRows(months);

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No monthly figures for this date.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Income and expenses, last 12 months</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={RESULT_CONFIG}
            className="aspect-auto h-[260px] w-full"
            aria-hidden="true"
          >
            <ComposedChart data={rows} margin={{ left: 4, right: 8 }}>
              {AXES}
              {TOOLTIP}
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="income" fill="var(--color-income)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[3, 3, 0, 0]} />
              <Line
                dataKey="net_income"
                type="monotone"
                stroke="var(--color-net_income)"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ChartContainer>
          <ScreenReaderTable
            caption="Income, expenses and net income by month"
            rows={rows}
            keys={["income", "expenses", "net_income"]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cash at month end</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={CASH_CONFIG}
            className="aspect-auto h-[260px] w-full"
            aria-hidden="true"
          >
            <LineChart data={rows} margin={{ left: 4, right: 8 }}>
              {AXES}
              {TOOLTIP}
              <Line
                dataKey="cash"
                type="monotone"
                stroke="var(--color-cash)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ChartContainer>
          <ScreenReaderTable caption="Cash at month end by month" rows={rows} keys={["cash"]} />
        </CardContent>
      </Card>
    </div>
  );
}
