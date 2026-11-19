"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { HandCoins } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import { readyData, type ExecutiveData } from "../../_lib/executive-data";
import { agingPoints, collectionTrend, hasActivity, monthLabel } from "../../_lib/executive-sections";
import { EXECUTIVE_LAYOUT as L } from "../../_lib/executive-layout";
import { compactPeso, formatMetric, toNumber } from "../../_lib/metrics";
import { CARD_STATE_TEXT, balanceHeading } from "../../_lib/executive-overview";
import { Figure, SectionShell, SourceGate, figureText } from "./section-shell";

const trendConfig = {
  due: { label: "Due", color: "var(--chart-2)" },
  collected: { label: "Collected", color: "var(--chart-1)" },
} satisfies ChartConfig;

const agingConfig = { amount: { label: "Past due", color: "var(--chart-4)" } } satisfies ChartConfig;

const money = (v: unknown) => formatCurrency(Number(v));

/** `pastPeriod`: the aging is today's, so a past period shows "No snapshot for this date" instead (No backfill). */
export function CollectionSection({ data, pastPeriod }: { data: ExecutiveData; pastPeriod: boolean }) {
  const trend = collectionTrend(readyData(data.efficiency)).map((p) => ({ ...p, label: monthLabel(p.period) }));
  const aging = agingPoints(readyData(data.aging));
  const totals = readyData(data.efficiency);
  const repayments = readyData(data.cashFlow)?.inflows?.repayments;

  return (
    <SectionShell
      title="Collection & Delinquency"
      icon={<HandCoins className="size-4" />}
      note="Due and collected cover the selected period. Aging is as of today, so a past period has none."
    >
      <div className={`mb-4 ${L.tiles}`}>
        <Figure label="Due in period" value={figureText(data.efficiency, toNumber(totals?.total_due), "currency")} />
        <Figure label="Collected against dues" value={figureText(data.efficiency, toNumber(totals?.total_collected), "currency")} />
        <Figure label="Repayments received" value={figureText(data.cashFlow, toNumber(repayments?.total), "currency")} />
        <Figure label="Penalties collected" value={figureText(data.cashFlow, toNumber(repayments?.penalty), "currency")} />
      </div>

      <div className={L.twoUp}>
        <div className={L.cell}>
          <h3 className="mb-2 text-sm font-medium">Due vs collected by month</h3>
          <SourceGate source={data.efficiency} empty={!hasActivity(trend, ["due", "collected"])}>
            <ChartContainer config={trendConfig} className="h-[220px] w-full min-w-0" aria-hidden="true">
              <BarChart data={trend} margin={{ left: 4, right: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} width={56} fontSize={11} tickFormatter={(v) => compactPeso(Number(v))} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v, name) => `${trendConfig[name as keyof typeof trendConfig]?.label ?? name}: ${money(v)}`} />} />
                <Bar dataKey="due" fill="var(--color-due)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="collected" fill="var(--color-collected)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
            <table className="sr-only">
              <caption>Due and collected by month</caption>
              <thead>
                <tr><th scope="col">Month</th><th scope="col">Due</th><th scope="col">Collected</th><th scope="col">Rate</th></tr>
              </thead>
              <tbody>
                {trend.map((p) => (
                  <tr key={p.period}>
                    <th scope="row">{p.label}</th>
                    <td>{money(p.due)}</td>
                    <td>{money(p.collected)}</td>
                    <td>{formatMetric(p.rate, "percent")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SourceGate>
        </div>

        <div className={L.cell}>
          <h3 className="mb-2 text-sm font-medium">{balanceHeading("Past due aging", pastPeriod)}</h3>
          <SourceGate
            source={data.aging}
            empty={!hasActivity(aging, ["amount"])}
            emptyText="Nothing past due."
            notice={pastPeriod ? CARD_STATE_TEXT.no_snapshot : null}
          >
            <ChartContainer config={agingConfig} className="h-[220px] w-full min-w-0" aria-hidden="true">
              <BarChart data={aging} layout="vertical" margin={{ left: 4, right: 12 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => compactPeso(Number(v))} />
                <YAxis type="category" dataKey="bucket" tickLine={false} axisLine={false} width={84} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => `Past due: ${money(v)}`} hideLabel={false} />} />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={[0, 3, 3, 0]} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
            <table className="sr-only">
              <caption>Past due aging</caption>
              <thead>
                <tr><th scope="col">Days past due</th><th scope="col">Loans</th><th scope="col">Amount</th></tr>
              </thead>
              <tbody>
                {aging.map((a) => (
                  <tr key={a.bucket}>
                    <th scope="row">{a.bucket}</th>
                    <td>{formatMetric(a.count, "count")}</td>
                    <td>{money(a.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SourceGate>
        </div>
      </div>
    </SectionShell>
  );
}
