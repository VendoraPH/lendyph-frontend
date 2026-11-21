"use client";

import { VISIBLE_SCROLLBAR } from "@/components/amla/visible-scrollbar";
import { ScrollBox } from "@/components/common/page-fill";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { amlaColumnAlign } from "@/lib/amla/report-view";
import type { AmlaComplianceReport } from "@/types/amla-reports";

/** The server's columns, rows and totals, shown as sent: every value is already formatted. */
export function ComplianceReportTable({ report }: { report: AmlaComplianceReport }) {
  const align = (key: string) => {
    const column = report.columns.find((c) => c.key === key);
    return column && amlaColumnAlign(column) === "right" ? "text-right" : "";
  };

  if (report.rows.length === 0) {
    return <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">Nothing to report for this selection.</p>;
  }

  return (
    <ScrollBox className={`min-h-0 flex-1 ${VISIBLE_SCROLLBAR}`} tabIndex={0} role="region" aria-label={`${report.title}, scrolls sideways`}>
      <Table className="min-w-[48rem]">
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            {report.columns.map((column) => (
              <TableHead key={column.key} className={align(column.key)}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.rows.map((row, index) => (
            // Report rows carry no id; their order is the server's and never changes in place.
            <TableRow key={index}>
              {report.columns.map((column) => (
                <TableCell key={column.key} className={`whitespace-normal ${align(column.key)}`}>
                  {row[column.key] ?? "—"}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        {report.totals && (
          <TableFooter className="sticky bottom-0 bg-muted">
            <TableRow>
              {report.columns.map((column, index) => (
                <TableCell key={column.key} className={`font-semibold whitespace-nowrap ${align(column.key)}`}>
                  {report.totals?.[column.key] ?? (index === 0 ? "Total" : "")}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </ScrollBox>
  );
}
