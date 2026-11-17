/**
 * The executive dashboard as a `ReportDocument`, so the reports module's PDF,
 * Excel and CSV exporters print it. Pure: the page adds the letterhead
 * (`applyChrome`) and picks the exporter.
 */

import type { ReportDocument, ReportSection } from "@/app/(app)/reports/_lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatDateRange, formatGeneratedAt } from "@/lib/report-format";
import { attentionItems } from "./attention";
import { isAsOfToday, overviewKpis, readyData, type ExecutiveData } from "./executive-data";
import { agingPoints, branchRows, productRows } from "./executive-sections";
import { DATA_UNAVAILABLE, METRICS, formatChange, formatMetric } from "./metrics";
import type { Period } from "./periods";

const money = (v: number | null) => (v === null ? DATA_UNAVAILABLE : formatCurrency(v));
const pct = (v: number | null) => formatMetric(v, "percent");

export function executiveDocument(
  data: ExecutiveData,
  period: Period,
  generatedAt: Date = new Date(),
): ReportDocument {
  const kpis = overviewKpis(data).map((k) => {
    const m = METRICS[k.id];
    const change = formatChange(k.change, m.kind);
    const scope = isAsOfToday(k.id) ? "As of today" : m.kind === "balance" ? `As of ${formatDate(period.to)}` : "For the period";
    return {
      label: m.label,
      value: k.state === "denied" ? "No access" : formatMetric(k.value, m.format),
      hint: [scope, change && `${change} vs ${k.changeBasis === "opening_balance" ? "opening balance" : "previous period"}`]
        .filter(Boolean)
        .join(" · "),
    };
  });

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
        { key: "share", header: "Share", align: "right" },
        { key: "par", header: "PAR 30", align: "right" },
      ],
      rows: productRows(readyData(data.products)).map((p) => ({
        name: p.name,
        loans: p.loans === null ? DATA_UNAVAILABLE : formatMetric(p.loans, "count"),
        outstanding: money(p.outstanding),
        share: pct(p.share),
        par: pct(p.par),
      })),
      emptyText: DATA_UNAVAILABLE,
    },
    {
      kind: "table",
      title: `Past Due Aging (as of ${period.to})`,
      columns: [
        { key: "bucket", header: "Days past due", width: 20 },
        { key: "count", header: "Installments", align: "right" },
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
        { key: "outstanding", header: "Outstanding", align: "right" },
        { key: "released", header: "Released", align: "right" },
        { key: "collected", header: "Collected", align: "right" },
        { key: "rate", header: "Collection rate", align: "right" },
        { key: "par", header: "PAR 30", align: "right" },
      ],
      rows: branchRows(readyData(data.balance), readyData(data.efficiency), readyData(data.performance)).map((b) => ({
        name: b.name,
        outstanding: money(b.outstanding),
        released: money(b.released),
        collected: money(b.collected),
        rate: pct(b.collectionRate),
        par: pct(b.par),
      })),
      emptyText: DATA_UNAVAILABLE,
    },
    {
      kind: "note",
      text:
        "Balances (outstanding, PAR, past due, active loans) are as of today whatever the period. " +
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
