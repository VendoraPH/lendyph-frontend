"use client";

import { cn } from "@/lib/utils";
import { formatCell } from "../_lib/formatters";
import type { ReportDocument, ReportSection } from "../_lib/types";

interface ReportPreviewProps {
  doc: ReportDocument;
}

/**
 * Preview renders the report the way the Excel file will look: orange title
 * band, period/generated-at strip, KPI grid of metric→value cards, and full
 * tables with header row, striped body, and a subtle totals row.
 *
 * Any visual change here should be mirrored in report-excel.ts to keep the
 * on-screen and exported artifacts aligned.
 */
export function ReportPreview({ doc }: ReportPreviewProps) {
  return (
    <div className="rounded-lg border bg-background shadow-sm overflow-hidden">
      {/* Brand header */}
      <div className="bg-brand-orange text-brand-orange-foreground px-6 py-4">
        <p className="text-[11px] uppercase tracking-[0.2em] opacity-80">
          {doc.meta.org}
        </p>
        <h2 className="text-xl font-bold leading-tight mt-1">
          {doc.meta.title}
        </h2>
        {doc.meta.subtitle && (
          <p className="text-sm opacity-90 mt-0.5">{doc.meta.subtitle}</p>
        )}
      </div>

      {/* Period / generated-at strip */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 bg-muted/40 border-b px-6 py-2.5">
        <div className="text-xs">
          <span className="text-muted-foreground">Period: </span>
          <span className="font-medium">{doc.meta.period ?? "—"}</span>
        </div>
        <div className="text-xs">
          <span className="text-muted-foreground">Generated: </span>
          <span className="font-medium">{doc.meta.generatedAt}</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-6">
        {doc.sections.map((section, idx) => (
          <SectionRenderer key={idx} section={section} />
        ))}

        <p className="text-[10px] italic text-muted-foreground pt-2 border-t">
          This report is auto-generated. Figures reflect data available at the
          time of export.
        </p>
      </div>
    </div>
  );
}

function SectionRenderer({ section }: { section: ReportSection }) {
  if (section.kind === "kpi_grid") {
    return (
      <div>
        {section.title && (
          <h3 className="text-sm font-semibold mb-3">{section.title}</h3>
        )}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {section.items.map((item, i) => (
            <div
              key={i}
              className={cn(
                "rounded-md bg-brand-orange/5 border border-brand-orange/10 px-4 py-3",
                "flex flex-col gap-1"
              )}
            >
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p
                className={cn(
                  "text-lg font-bold tabular-nums",
                  item.tone === "positive" && "text-green-700",
                  item.tone === "negative" && "text-red-700"
                )}
              >
                {item.value}
              </p>
              {item.hint && (
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {item.hint}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section.kind === "table") {
    return (
      <div>
        {section.title && (
          <h3 className="text-sm font-semibold mb-3">{section.title}</h3>
        )}

        {section.rows.length === 0 ? (
          <div className="rounded-md border border-dashed py-8 text-center text-sm italic text-muted-foreground">
            {section.emptyText ?? "No data available."}
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {section.columns.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        "px-3 py-2 font-semibold text-foreground whitespace-nowrap",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        (col.align ?? "left") === "left" && "text-left"
                      )}
                      style={col.width ? { minWidth: col.width } : undefined}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className={cn(
                      "border-t",
                      rowIdx % 2 === 1 && "bg-muted/20"
                    )}
                  >
                    {section.columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-3 py-2 tabular-nums",
                          col.align === "right" && "text-right",
                          col.align === "center" && "text-center",
                          (col.align ?? "left") === "left" && "text-left",
                          col.format === "text" && "font-normal"
                        )}
                      >
                        {formatCell(row, col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {section.totals && section.totals.length > 0 && (() => {
                const totals = section.totals!;
                const firstTotalIdx = section.columns.findIndex((c) =>
                  totals.some((t) => t.column === c.key)
                );
                const labelIdx = Math.max(0, firstTotalIdx - 1);
                return (
                  <tfoot>
                    <tr className="border-t-2 bg-brand-orange/5">
                      {section.columns.map((col, colIdx) => {
                        const match = totals.find((t) => t.column === col.key);
                        const isLabelCell = colIdx === labelIdx && !match;
                        return (
                          <td
                            key={col.key}
                            className={cn(
                              "px-3 py-2 font-bold tabular-nums",
                              col.align === "right" && "text-right",
                              col.align === "center" && "text-center",
                              (col.align ?? "left") === "left" && "text-left"
                            )}
                          >
                            {match?.value ?? (isLabelCell ? "Total" : "")}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        )}
      </div>
    );
  }

  if (section.kind === "note") {
    return (
      <p className="text-sm italic text-muted-foreground">{section.text}</p>
    );
  }

  return null;
}
