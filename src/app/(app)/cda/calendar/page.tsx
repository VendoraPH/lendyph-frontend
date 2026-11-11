"use client";

import { useCallback } from "react";
import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate } from "@/lib/format";
import type { CdaCalendarRow } from "@/types/cda";
import { CdaPage } from "../_components/cda-page";
import { DeadlineBadge, ReportStatusBadge, ToneBadge } from "../_components/tone-badge";
import { REPORT_PAGES, reportName } from "../_lib/labels";

function Row({ row }: { row: CdaCalendarRow }) {
  const name = reportName(row.report_type, row.part);
  return (
    <TableRow>
      <TableCell>
        {row.restricted ? (
          <span className="font-medium">{name}</span>
        ) : (
          <Link href={REPORT_PAGES[row.report_type]?.href ?? "/cda"} className="font-medium hover:underline">
            {name}
          </Link>
        )}
      </TableCell>
      <TableCell>{formatDate(row.default_due_on)}</TableCell>
      <TableCell>
        {row.effective_deadline !== row.default_due_on ? (
          <>
            {formatDate(row.effective_deadline)}
            {row.due_override_reference && <span className="block text-xs text-muted-foreground">{row.due_override_reference}</span>}
          </>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>{row.restricted ? <ToneBadge tone="neutral" label="Restricted" /> : <ReportStatusBadge status={row.display_status} />}</TableCell>
      <TableCell>{row.applicable ? <DeadlineBadge daysRemaining={row.days_remaining} filed={row.filed} /> : "—"}</TableCell>
    </TableRow>
  );
}

function Calendar({ year }: { year: number }) {
  const resource = useApiResource(useCallback(() => cdaService.getCalendar(year), [year]));
  return (
    <DataState
      resource={resource}
      endpoints={[`GET ${API_ENDPOINTS.CDA.CALENDAR(year)}`]}
      summary={`The ${year} filing deadlines`}
      isEmpty={(rows) => rows.length === 0}
      emptyMessage="No reports for this year."
    >
      {(rows) => (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Moved to</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time left</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <Row key={row.id} row={row} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </DataState>
  );
}

/** Every report's deadline for the year, in the server's order (soonest first), with CDA's extensions. */
export default function Page() {
  return (
    <CdaPage
      title="Compliance Calendar"
      description="Every CDA report due for the year, with CDA's extension or a report's own deadline where one was set."
    >
      {(ctx) => ctx && <Calendar key={ctx.year} year={ctx.year} />}
    </CdaPage>
  );
}
