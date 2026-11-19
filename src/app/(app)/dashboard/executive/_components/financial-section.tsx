"use client";

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Landmark } from "lucide-react";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import { readyData, type ExecutiveData } from "../../_lib/executive-data";
import { financialBooks } from "../../_lib/executive-books";
import { hasActivity, incomeExpenseSeries, monthLabel } from "../../_lib/executive-sections";
import { EXECUTIVE_LAYOUT as L } from "../../_lib/executive-layout";
import { compactPeso, toNumber } from "../../_lib/metrics";
import { Figure, SectionShell, SourceGate, figureText } from "./section-shell";

const config = {
  income: { label: "Income", color: "var(--chart-1)" },
  expenses: { label: "Expenses", color: "var(--chart-4)" },
  net: { label: "Net income", color: "var(--chart-2)" },
} satisfies ChartConfig;

/**
 * Financial Performance, from `/accounting/dashboard`: its period lines (cash
 * basis), `cash_total`, assets and equity. While its `books_state` isn't
 * ready, the server's label and reason show instead, never ₱0.00. Required
 * Allowance is the overview card's own figure (and state).
 */
export function FinancialSection({
  data,
  allowance,
  capitalNotes,
}: {
  data: ExecutiveData;
  /** The overview's Required Allowance card in words: the figure the allowance posting books. */
  allowance: string;
  /** The share capital and allowance cards' filter notes, from the cards' own filter lists. */
  capitalNotes: (string | null)[];
}) {
  const notes = [...new Set(capitalNotes.filter((n): n is string => n !== null))];
  const acc = readyData(data.accounting);
  const books = acc ? financialBooks(acc) : null;
  const notice = books?.notice ?? null;
  const series = incomeExpenseSeries(acc).map((p) => ({ ...p, label: monthLabel(p.month) }));
  const share = readyData(data.shareCapital);

  return (
    <SectionShell
      title="Financial Performance"
      icon={<Landmark className="size-4" />}
      note="Ledger figures come from posted journals. Interest, penalty and fee income are counted when the money is received (cash basis)."
    >
      <SourceGate source={data.accounting} height="h-24" notice={notice}>
        <div className={L.tiles}>
          {books?.figures.map((f) => <Figure key={f.label} label={f.label} value={f.value} hint={f.hint} />)}
        </div>
      </SourceGate>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <div className={L.cell}>
          <h3 className="mb-2 text-sm font-medium">Income vs expenses, last 12 months</h3>
          <SourceGate
            notice={notice}
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
          <h3 className="text-sm font-medium">Capital and allowance</h3>
          {notes.length ? <p className="text-[11px] text-amber-700 dark:text-amber-400">{notes.join(" ")}</p> : null}
          <div className={L.tiles}>
            <Figure label="Share capital" value={figureText(data.shareCapital, toNumber(share?.closing_balance), "currency")} hint="Closing balance" />
            <Figure
              label="Required allowance"
              value={allowance}
              hint="As the allowance posting books it"
            />
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
