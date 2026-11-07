import type { ReportDocument, ReportSection } from "@/app/(app)/reports/_lib/types";
import { formatFieldValue, formatTableValue } from "./report-values";
import { REPORT_META, STATUS_META } from "./labels";
import type { CdaReport } from "@/types/cda";

/**
 * A CDA report as a `ReportDocument`, so it goes out through the same PDF,
 * Excel, Word and CSV exporters as every other report. Pure: the letterhead,
 * reference and sign-off block are added by `applyChrome` at export time.
 *
 * Every value is pre-formatted text, exactly as the screen shows it, so an
 * export can never disagree with what the preparer reviewed.
 */
export function cdaReportToDocument(report: CdaReport, generatedAt: string, orgName = ""): ReportDocument {
  const meta = REPORT_META[report.type];
  const sections: ReportSection[] = [
    {
      kind: "fields",
      title: "Report details",
      items: [
        { label: "Report", value: meta.title },
        { label: "Fiscal year", value: String(report.year) },
        { label: "Status", value: STATUS_META[report.status].label },
        { label: "Readiness", value: `${Math.round(report.readiness)}%` },
        {
          label: "Template",
          value: report.template ? `${report.template.name} v${report.template.version}` : "—",
        },
        ...(report.snapshot_checksum ? [{ label: "Snapshot checksum", value: report.snapshot_checksum }] : []),
      ],
    },
  ];

  for (const section of report.sections) {
    if (section.kind === "fields") {
      sections.push({
        kind: "fields",
        title: section.title,
        items: section.fields.map((field) => ({
          label: field.label,
          value: field.remarks ? `${formatFieldValue(field)} (${field.remarks})` : formatFieldValue(field),
        })),
      });
    } else {
      sections.push({
        kind: "table",
        title: section.title,
        columns: section.columns.map((c) => ({
          key: c.key,
          header: c.label,
          align: c.format && c.format !== "text" ? "right" : "left",
        })),
        rows: section.rows.map((row) =>
          Object.fromEntries(section.columns.map((c) => [c.key, formatTableValue(row[c.key] ?? null, c)])),
        ),
        emptyText: "No rows for this year.",
        compact: section.columns.length > 8,
      });
    }
  }

  const critical = report.issues.filter((i) => i.severity === "critical").length;
  if (critical > 0) {
    sections.push({
      kind: "note",
      text: `DRAFT — ${critical} critical validation issue${critical === 1 ? "" : "s"} still open.`,
    });
  }

  return {
    reportId: "cda_report",
    meta: {
      title: `${meta.title} — FY ${report.year}`,
      subtitle: "CDA Compliance",
      period: `Fiscal year ${report.year}`,
      generatedAt,
      org: orgName,
    },
    sections,
  };
}
