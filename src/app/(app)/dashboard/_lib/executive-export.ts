/**
 * The executive dashboard as a `ReportDocument`, so the reports module's PDF,
 * Excel and CSV exporters print it. Pure: the page adds the letterhead
 * (`applyChrome`) and picks the exporter.
 */

import type { ReportDocument, ReportSection } from "@/app/(app)/reports/_lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatDateRange, formatGeneratedAt } from "@/lib/report-format";
import { attentionItems } from "./attention";
import type { ExecutiveBranches, ExecutiveOverview, ExecutivePeriod } from "@/types/executive-dashboard";
import { readyData, type ExecutiveData } from "./executive-data";
import { branchTable, cardViews } from "./executive-overview";
import { agingPoints, productRows } from "./executive-sections";
import { DATA_UNAVAILABLE, formatMetric } from "./metrics";

const money = (v: number | null) => (v === null ? DATA_UNAVAILABLE : formatCurrency(v));
const pct = (v: number | null) => formatMetric(v, "percent");

export interface ExecutiveExportInput {
  data: ExecutiveData;
  /** The dashboard's own figures; null when they could not be read. */
  overview: ExecutiveOverview | null;
  branches: ExecutiveBranches | null;
  /** The server's period. */
  period: ExecutivePeriod;
}

export function executiveDocument(
  { data, overview, branches, period }: ExecutiveExportInput,
  generatedAt: Date = new Date(),
): ReportDocument {
  // The server's cards, as the screen shows them; a card the user may not see is left out.
  const kpis = (overview ? cardViews(overview) : []).map((card) => ({
    label: card.label,
    value: card.valueText,
    hint: [card.asOfText, card.changeText && `${card.changeText} ${card.changeBasis}`].filter(Boolean).join(" · "),
  }));
  const sent = overview?.filters_applied ?? [];
  const table = branches ? branchTable(branches, sent) : null;

  const sections: ReportSection[] = [
    { kind: "kpi_grid", title: "Executive Overview", items: kpis },
    {
      kind: "table",
      title: "Requires Attention",
      columns: [
        { key: "tone", header: "Priority", width: 14 },
        { key: "title", header: "Item", width: 40 },
        { key: "detail", header: "Detail", width: 60 },
      ],
      rows: attentionItems(data).map((a) => ({ tone: a.tone === "critical" ? "Critical" : "Warning", title: a.title, detail: a.detail })),
      emptyText: "Nothing needs attention.",
    },
    {
      kind: "table",
      title: "Portfolio by Product (as of today)",
      columns: [
        { key: "name", header: "Product", width: 30 },
        { key: "loans", header: "Loans", align: "right" },
        { key: "outstanding", header: "Outstanding", align: "right" },
        { key: "principal", header: "Principal Balance", align: "right" },
        { key: "share", header: "Share of portfolio", align: "right" },
        { key: "par", header: "PAR 30", align: "right" },
      ],
      rows: productRows(readyData(data.products)).map((p) => ({
        name: p.name,
        loans: p.loans === null ? DATA_UNAVAILABLE : formatMetric(p.loans, "count"),
        outstanding: money(p.outstanding),
        principal: money(p.principal),
        share: p.share === null ? "—" : pct(p.share),
        par: pct(p.par),
      })),
      emptyText: DATA_UNAVAILABLE,
    },
    {
      kind: "table",
      title: `Past Due Aging (as of ${formatDate(period.to)})`,
      columns: [
        { key: "bucket", header: "Days past due", width: 20 },
        { key: "count", header: "Loans", align: "right" },
        { key: "amount", header: "Amount", align: "right" },
      ],
      rows: agingPoints(readyData(data.aging)).map((a) => ({
        bucket: a.bucket,
        count: formatMetric(a.count, "count"),
        amount: formatCurrency(a.amount),
      })),
      emptyText: DATA_UNAVAILABLE,
    },
    {
      kind: "table",
      title: "Branch Performance",
      compact: true,
      columns: [
        { key: "name", header: "Branch", width: 24 },
        ...(table?.columns ?? []).map((c) => ({ key: c.key, header: c.header, align: "right" as const })),
      ],
      // The server's rows, then its totals: never a sum of the rows.
      rows: table
        ? [...table.rows.map((r) => ({ name: r.name, ...r.cells })), { name: "Total", ...table.totals }]
        : [],
      emptyText: DATA_UNAVAILABLE,
    },
    {
      kind: "note",
      text:
        (table ? `${table.balancesNote} ${table.updated}. ` : "") +
        `"${DATA_UNAVAILABLE}" means the figure could not be read; it is never shown as zero.`,
    },
  ];

  return {
    reportId: "executive_dashboard",
    meta: {
      title: "Executive Dashboard",
      period: formatDateRange(period.from, period.to),
      generatedAt: formatGeneratedAt(generatedAt),
      org: "",
    },
    sections,
  };
}
