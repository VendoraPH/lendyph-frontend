"use client";

import { Cell, Pie, PieChart } from "recharts";
import { Briefcase } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import { readyData, type ExecutiveData } from "../../_lib/executive-data";
import { pipelineStages, productRows, type ProductRow } from "../../_lib/executive-sections";
import { DATA_UNAVAILABLE, compactPeso, formatMetric, toNumber } from "../../_lib/metrics";
import { Figure, SectionShell, SourceGate } from "./section-shell";

const SLICE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
/** Products past the named ones share one muted colour; each keeps its own slice and figure (no browser sum). */
const REST_COLOR = "var(--muted-foreground)";
const NAMED_SLICES = 4;

/** Every product with a balance, largest first, each as its own server figure. */
function slices(rows: ProductRow[]) {
  return rows
    .filter((r) => (r.outstanding ?? 0) > 0)
    .map((r, i) => ({ name: r.name, value: r.outstanding ?? 0, color: i < NAMED_SLICES ? SLICE_COLORS[i] : REST_COLOR }));
}

const money = (v: number | null) => (v === null ? DATA_UNAVAILABLE : formatCurrency(v));

export function PortfolioSection({ data }: { data: ExecutiveData }) {
  const rows = productRows(readyData(data.products));
  const pie = slices(rows);
  const named = pie.slice(0, NAMED_SLICES);
  const others = pie.length - named.length;
  const config = Object.fromEntries(pie.map((s, i) => [`s${i}`, { label: s.name, color: s.color }])) satisfies ChartConfig;
  const out = readyData(data.balance)?.outstanding;
  const stages = pipelineStages(readyData(data.loanStats));

  return (
    <SectionShell
      title="Loan Portfolio"
      icon={<Briefcase className="size-4" />}
      note="Outstanding is everything owed as of today. Share of released is the report's share of the amount released."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <SourceGate source={data.products} empty={pie.length === 0} emptyText="No outstanding loans.">
          <div>
            <ChartContainer config={config} className="mx-auto aspect-square h-[220px]" aria-hidden="true">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent formatter={(v, name) => `${name}: ${formatCurrency(Number(v))}`} hideLabel />} />
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="90%" strokeWidth={others > 0 ? 1 : 0} stroke="var(--card)" isAnimationActive={false}>
                  {pie.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="mt-2 space-y-1 text-xs">
              {named.map((s) => (
                <li key={s.name} className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="tabular-nums text-muted-foreground">{compactPeso(s.value)}</span>
                </li>
              ))}
              {others > 0 ? (
                <li className="flex items-center gap-2 text-muted-foreground">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: REST_COLOR }} aria-hidden="true" />
                  <span className="flex-1 truncate">
                    {others} other {others === 1 ? "product" : "products"}
                  </span>
                </li>
              ) : null}
            </ul>
          </div>
        </SourceGate>

        <SourceGate source={data.products} empty={rows.length === 0}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Portfolio by product</caption>
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="py-2 text-left font-medium">Product</th>
                  <th scope="col" className="py-2 text-right font-medium">Loans</th>
                  <th scope="col" className="py-2 text-right font-medium">Outstanding</th>
                  <th scope="col" className="py-2 text-right font-medium">Share of released</th>
                  <th scope="col" className="py-2 text-right font-medium">PAR 30</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((r) => (
                  <tr key={r.name} className="border-b last:border-0">
                    <th scope="row" className="py-1.5 text-left font-normal">{r.name}</th>
                    <td className="py-1.5 text-right tabular-nums">{r.loans === null ? "—" : formatMetric(r.loans, "count")}</td>
                    <td className="py-1.5 text-right tabular-nums">{money(r.outstanding)}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.share === null ? "—" : formatMetric(r.share, "percent")}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.par === null ? "—" : formatMetric(r.par, "percent")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SourceGate>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-medium">Outstanding by component (as of today)</h3>
          <SourceGate source={data.balance} height="h-24">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Figure label="Principal" value={money(toNumber(out?.principal))} />
              <Figure label="Interest" value={money(toNumber(out?.interest))} />
              <Figure label="Penalty" value={money(toNumber(out?.penalty))} />
              <Figure label="Insurance" value={money(toNumber(out?.insurance))} />
            </div>
          </SourceGate>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium">Application pipeline</h3>
          <SourceGate source={data.loanStats} height="h-24">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stages.map((s) => (
                <Figure key={s.status} label={s.label} value={formatMetric(s.count, "count")} />
              ))}
            </div>
          </SourceGate>
        </div>
      </div>
    </SectionShell>
  );
}
