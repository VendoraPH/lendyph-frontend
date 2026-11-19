"use client";

import { Cell, Pie, PieChart } from "recharts";
import { Briefcase } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import { readyData, type ExecutiveData } from "../../_lib/executive-data";
import { pipelineStages, productRows, productShareSlices } from "../../_lib/executive-sections";
import { DATA_UNAVAILABLE, formatMetric, toNumber } from "../../_lib/metrics";
import { EXECUTIVE_LAYOUT as L } from "../../_lib/executive-layout";
import type { ExecutiveFilterKey } from "@/types/executive-dashboard";
import { sectionFilterNote } from "../../_lib/executive-books";
import { CARD_STATE_TEXT, balanceHeading } from "../../_lib/executive-overview";
import { VISIBLE_SCROLLBAR } from "@/components/amla/visible-scrollbar";
import { Figure, SectionShell, SourceGate } from "./section-shell";

const SLICE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
/** The server's "other products" row has one muted colour. */
const REST_COLOR = "var(--muted-foreground)";

const money = (v: number | null) => (v === null ? DATA_UNAVAILABLE : formatCurrency(v));

/** `pastPeriod`: product shares and outstanding are today's balances, so a past period shows "No snapshot for this date" (No backfill). */
export function PortfolioSection({
  data,
  pastPeriod,
  sentFilters,
}: {
  data: ExecutiveData;
  pastPeriod: boolean;
  sentFilters: ExecutiveFilterKey[];
}) {
  // The pipeline's counts follow the branch only (GET /loans `meta.stats`).
  const pipelineNote = sectionFilterNote(sentFilters, "pipeline");
  const notice = pastPeriod ? CARD_STATE_TEXT.no_snapshot : null;
  const rows = productRows(readyData(data.products));
  // The server's shares: its named products, then its "other" row.
  const pie = productShareSlices(readyData(data.products)).map((s, i) => ({
    ...s,
    value: s.share,
    color: s.other ? REST_COLOR : SLICE_COLORS[i % SLICE_COLORS.length],
  }));
  const config = Object.fromEntries(pie.map((s, i) => [`s${i}`, { label: s.name, color: s.color }])) satisfies ChartConfig;
  // The server's named fields: Principal Balance and Outstanding are the loan
  // pages' figures; interest, penalty and the premium are its components.
  const balance = readyData(data.balance);
  const components = balance?.outstanding;
  const stages = pipelineStages(readyData(data.loanStats));

  return (
    <SectionShell
      title="Loan Portfolio"
      icon={<Briefcase className="size-4" />}
      note="Outstanding is everything owed as of today. Share of portfolio is each product's share of the unpaid principal, from the report."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <SourceGate source={data.products} empty={pie.length === 0} emptyText="No outstanding loans." notice={notice}>
          <div className={L.cell}>
            <ChartContainer config={config} className="mx-auto aspect-square h-[220px]" aria-hidden="true">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent formatter={(v, name) => `${name}: ${formatMetric(Number(v), "percent")}`} hideLabel />} />
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="90%" strokeWidth={pie.length > 1 ? 1 : 0} stroke="var(--card)" isAnimationActive={false}>
                  {pie.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="mt-2 space-y-1 text-xs">
              {pie.map((s) => (
                <li key={s.name} className={s.other ? "flex items-center gap-2 text-muted-foreground" : "flex items-center gap-2"}>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="tabular-nums text-muted-foreground">{formatMetric(s.share, "percent")}</span>
                </li>
              ))}
            </ul>
          </div>
        </SourceGate>

        <SourceGate source={data.products} empty={rows.length === 0} notice={notice}>
          <div className={`${L.cell} overflow-x-auto pb-1 ${VISIBLE_SCROLLBAR}`} tabIndex={0} role="region" aria-label="Portfolio by product, scrolls sideways">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Portfolio by product</caption>
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="py-2 pr-3 text-left font-medium">Product</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-medium">Loans</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-medium">Outstanding</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-medium">Principal Balance</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-medium">Share of portfolio</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-medium">PAR 30</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((r) => (
                  <tr key={r.name} className="border-b last:border-0">
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal">{r.name}</th>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{r.loans === null ? "—" : formatMetric(r.loans, "count")}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{money(r.outstanding)}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{money(r.principal)}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{r.share === null ? "—" : formatMetric(r.share, "percent")}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{r.par === null ? "—" : formatMetric(r.par, "percent")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SourceGate>
      </div>

      <div className={`mt-4 ${L.twoUp}`}>
        <div className={L.cell}>
          <h3 className="mb-2 text-sm font-medium">{balanceHeading("Outstanding by component", pastPeriod)}</h3>
          <SourceGate source={data.balance} height="h-24" notice={notice}>
            <div className={L.tiles}>
              <Figure label="Principal Balance" value={money(toNumber(balance?.outstanding_principal))} />
              <Figure label="Interest" value={money(toNumber(components?.interest))} />
              <Figure label="Penalty" value={money(toNumber(components?.penalty))} />
              <Figure label="Insurance premium" value={money(toNumber(components?.insurance))} />
              <Figure label="Outstanding" value={money(toNumber(balance?.total_outstanding))} hint="Everything owed" />
            </div>
          </SourceGate>
        </div>
        <div className={L.cell}>
          <h3 className="mb-2 text-sm font-medium">Application pipeline (as of today)</h3>
          <SourceGate source={data.loanStats} height="h-24">
            <div className={L.tiles}>
              {stages.map((s) => (
                <Figure key={s.status} label={s.label} value={formatMetric(s.count, "count")} />
              ))}
            </div>
          </SourceGate>
          {pipelineNote ? <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">{pipelineNote}</p> : null}
        </div>
      </div>
    </SectionShell>
  );
}
