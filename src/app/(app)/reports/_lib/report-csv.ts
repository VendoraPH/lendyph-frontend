import { saveAs } from "file-saver";
import { todayISO } from "@/lib/format";
import { csvBlob, toCsvRow as row } from "@/lib/csv";
import { formatCell } from "@/lib/report-format";
import type { ReportDocument } from "./types";

/**
 * CSV export — simple, plain text. Each section is rendered as its own
 * block with a blank line separator. KPI grids become metric/value pairs;
 * tables get headers + rows + an optional totals row.
 *
 * Split from the download so tests can assert against the text we actually
 * write rather than against the model that produced it.
 */
export function renderReportCsv(doc: ReportDocument): string {
  const lines: string[] = [];

  // Header block
  lines.push(row([doc.meta.title]));
  lines.push(row([doc.meta.org]));
  if (doc.meta.subtitle) lines.push(row([doc.meta.subtitle]));
  if (doc.meta.reference) lines.push(row([`Reference: ${doc.meta.reference}`]));
  lines.push(row([`Period: ${doc.meta.period ?? ""}`]));
  if (doc.meta.branchLabel) lines.push(row([`Branch: ${doc.meta.branchLabel}`]));
  lines.push(row([`Generated: ${doc.meta.generatedAt}`]));
  if (doc.meta.preparedBy) {
    lines.push(row([`Prepared by: ${doc.meta.preparedBy}`]));
  }
  lines.push("");

  for (const section of doc.sections) {
    if (section.kind === "kpi_grid") {
      if (section.title) {
        lines.push(row([section.title]));
      }
      // The hint qualifies the figure on screen ("Withheld from ₱370,000.00
      // principal released"), so it gets its own column — but only when the
      // block actually carries one, to keep hint-less reports unchanged.
      const hasHints = section.items.some((item) => !!item.hint);
      lines.push(row(hasHints ? ["Metric", "Value", "Note"] : ["Metric", "Value"]));
      for (const item of section.items) {
        lines.push(
          row(hasHints ? [item.label, item.value, item.hint] : [item.label, item.value])
        );
      }
      lines.push("");
    } else if (section.kind === "table") {
      if (section.title) {
        lines.push(row([section.title]));
      }
      if (section.rows.length === 0) {
        lines.push(row([section.emptyText ?? "No data available."]));
        lines.push("");
        continue;
      }
      lines.push(row(section.columns.map((c) => c.header)));
      for (const r of section.rows) {
        lines.push(row(section.columns.map((c) => formatCell(r, c))));
      }
      if (section.totals && section.totals.length > 0) {
        const totalRow = section.columns.map((c) => {
          const t = section.totals!.find((x) => x.column === c.key);
          return t ? t.value : "";
        });
        const firstTotalIdx = section.columns.findIndex((c) =>
          section.totals!.some((t) => t.column === c.key)
        );
        if (firstTotalIdx > 0) totalRow[firstTotalIdx - 1] = "Total";
        lines.push(row(totalRow));
      }
      lines.push("");
    } else if (section.kind === "fields") {
      if (section.title) lines.push(row([section.title]));
      lines.push(row(["Particular", "Value"]));
      for (const item of section.items) {
        lines.push(row([item.label, item.value]));
      }
      lines.push("");
    } else if (section.kind === "signatures") {
      // Empty value column: a printed CSV is still signed by hand.
      lines.push(row(["Signatories", ""]));
      for (const role of section.roles) {
        lines.push(row([role, ""]));
      }
      lines.push("");
    } else if (section.kind === "note") {
      lines.push(row([section.text]));
      lines.push("");
    }
  }

  return lines.join("\r\n");
}

/** The BOM `csvBlob` prepends is what stops Excel mangling the peso sign. */
export function exportReportToCsv(doc: ReportDocument): void {
  const slug = doc.meta.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const date = todayISO();
  saveAs(csvBlob(renderReportCsv(doc)), `${slug}-${date}.csv`);
}
