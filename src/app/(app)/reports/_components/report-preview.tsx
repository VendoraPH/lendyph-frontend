"use client";

import { cn } from "@/lib/utils";
import { formatCell } from "@/lib/report-format";
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
      {/* Brand header — letterhead: logo, org, title, reference */}
      <div className="bg-brand-orange text-brand-orange-foreground px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {doc.meta.logoUrl && (
              // Plain <img>: the logo is an absolute URL on the API's storage
              // host, and next/image would demand that host be allow-listed in
              // next.config for what is a single decorative letterhead mark.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={doc.meta.logoUrl}
                alt=""
                className="h-11 w-11 shrink-0 rounded bg-white/90 object-contain p-1"
              />
            )}
            <div className="min-w-0">
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
          </div>

          {doc.meta.reference && (
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-wider opacity-75">
                Reference
              </p>
              <p className="text-xs font-semibold tabular-nums mt-0.5">
                {doc.meta.reference}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Period / scope / generated-at strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 bg-muted/40 border-b px-6 py-2.5">
        <MetaItem label="Period" value={doc.meta.period ?? "—"} />
        {doc.meta.branchLabel && (
          <MetaItem label="Branch" value={doc.meta.branchLabel} />
        )}
        <MetaItem label="Generated" value={doc.meta.generatedAt} />
        {doc.meta.preparedBy && (
          <MetaItem label="Prepared by" value={doc.meta.preparedBy} />
        )}
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

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
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

  if (section.kind === "fields") {
    return (
      <div>
        {section.title && (
          <h3 className="text-sm font-semibold mb-3">{section.title}</h3>
        )}
        <dl className="grid gap-x-8 gap-y-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 rounded-md border bg-muted/20 px-4 py-3">
          {section.items.map((item, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-muted-foreground shrink-0">
                {item.label}
              </dt>
              <dd className="text-sm font-medium text-right tabular-nums min-w-0 truncate">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  if (section.kind === "signatures") {
    return (
      <div className="pt-4">
        <div className="grid gap-8 grid-cols-1 sm:grid-cols-3">
          {section.roles.map((role) => (
            <div key={role}>
              {/* Ruled line first, caption under it — the printed convention,
                  so the block reads the same on screen and on paper. */}
              <div className="h-10" />
              <div className="border-t border-foreground/40" />
              <p className="text-[11px] text-muted-foreground mt-1">{role}</p>
            </div>
          ))}
        </div>
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
