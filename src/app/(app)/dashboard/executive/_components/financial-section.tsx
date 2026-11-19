"use client";

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Landmark } from "lucide-react";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency, formatDate } from "@/lib/format";
import { cashBalance, fromCentavos, readyData, type ExecutiveData } from "../../_lib/executive-data";
import { hasActivity, incomeExpenseSeries, monthLabel } from "../../_lib/executive-sections";
import { EXECUTIVE_LAYOUT as L } from "../../_lib/executive-layout";
import { compactPeso, formatMetric, toNumber } from "../../_lib/metrics";
import { Figure, SectionShell, SourceGate, figureText } from "./section-shell";

const config = {
  income: { label: "Income", color: "var(--chart-1)" },
  expenses: { label: "Expenses", color: "var(--chart-4)" },
  net: { label: "Net income", color: "var(--chart-2)" },
} satisfies ChartConfig;

const money = (v: number | null) => formatMetric(v, "currency");

export function FinancialSection({ data }: { data: ExecutiveData }) {
  const acc = readyData(data.accounting);
  const series = incomeExpenseSeries(acc).map((p) => ({ ...p, label: monthLabel(p.month) }));
  const income = readyData(data.income);
  const share = readyData(data.shareCapital);
  const provisioning = readyData(data.provisioning);

  return (
    <SectionShell
      title="Financial Performance"
      icon={<Landmark className="size-4" />}
      note="Ledger figures come from posted journals. Cash-basis income is what was collected in the period, not what was recognized."
    >
      <SourceGate source={data.accounting} height="h-24">
        <div className={L.tiles}>
          <Figure label="Income (period)" value={money(fromCentavos(acc?.period.income))} />
          <Figure label="Expenses (period)" value={money(fromCentavos(acc?.period.expenses))} />
          <Figure label="Net income (period)" value={money(fromCentavos(acc?.period.net_income))} />
          <Figure label="Cash balance" value={money(cashBalance(acc))} hint={acc ? `All money accounts, as of ${formatDate(acc.as_of)}` : undefined} />
          <Figure label="Total assets" value={money(fromCentavos(acc?.total_assets))} />
          <Figure label="Total equity" value={money(fromCentavos(acc?.total_equity))} />
        </div>
      </SourceGate>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <div className={L.cell}>
          <h3 className="mb-2 text-sm font-medium">Income vs expenses, last 12 months</h3>
          <SourceGate
            source={data.accounting}
            empty={!hasActivity(series, ["income", "expenses", "net"])}
            emptyText="No income or expenses posted in these 12 months."
          >
            <ChartContainer config={config} className="h-[240px] w-full min-w-0" aria-hidden="true">
              <ComposedChart data={series} margin={{ left: 4, right: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} width={56} fontSize={11} tickFormatter={(v) => compactPeso(Number(v))} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v, name) => `${config[name as keyof typeof config]?.label ?? name}: ${formatCurrency(Number(v))}`} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="income" fill="var(--color-income)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Line dataKey="net" stroke="var(--color-net)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ChartContainer>
            <table className="sr-only">
              <caption>Income and expenses by month</caption>
              <thead>
                <tr><th scope="col">Month</th><th scope="col">Income</th><th scope="col">Expenses</th><th scope="col">Net income</th></tr>
              </thead>
              <tbody>
                {series.map((p) => (
                  <tr key={p.month}>
                    <th scope="row">{p.label}</th>
                    <td>{formatCurrency(p.income)}</td>
                    <td>{formatCurrency(p.expenses)}</td>
                    <td>{formatCurrency(p.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SourceGate>
        </div>

        <div className={`${L.cell} space-y-2`}>
          <h3 className="text-sm font-medium">Collected income (cash basis)</h3>
          <SourceGate source={data.income} height="h-40">
            <div className={L.tiles}>
              <Figure label="Interest" value={money(toNumber(income?.interest_income))} />
              <Figure label="Processing fees" value={money(toNumber(income?.processing_fees))} />
              <Figure label="Service fees" value={money(toNumber(income?.service_fee))} />
              <Figure label="Other fees" value={money(toNumber(income?.other_fees))} />
              <Figure label="Penalties" value={money(toNumber(income?.penalty_income))} />
              <Figure label="Total" value={money(toNumber(income?.total))} />
            </div>
          </SourceGate>
          <div className={L.tiles}>
            <Figure label="Share capital" value={figureText(data.shareCapital, toNumber(share?.closing_balance), "currency")} hint="Closing balance" />
            <Figure label="Required allowance" value={figureText(data.provisioning, toNumber(provisioning?.totals?.required_allowance), "currency")} hint="Provisioning" />
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
