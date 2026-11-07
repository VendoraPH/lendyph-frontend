"use client";

import { useCallback } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate, todayISO } from "@/lib/format";
import type { CdaCalendarEntry } from "@/types/cda";
import { CdaPageHeader } from "../_components/cda-page-header";
import { ReportStatusBadge, ToneBadge } from "../_components/tone-badge";
import { useCdaYear } from "../_hooks/use-cda-year";
import { daysUntil, deadlineState, describeDaysLeft, effectiveDeadline } from "../_lib/deadline";
import { DEADLINE_TONE, REPORT_META } from "../_lib/labels";
import { isFiled } from "../_lib/workflow";

function DeadlineBadge({ entry, today }: { entry: CdaCalendarEntry; today: string }) {
  const due = effectiveDeadline(entry);
  const days = daysUntil(due, today);
  const state = deadlineState(days, isFiled(entry.status));
  return <ToneBadge tone={DEADLINE_TONE[state]} label={state === "done" ? "Filed" : describeDaysLeft(days)} />;
}

function Calendar() {
  const year = useCdaYear();
  const resource = useApiResource(useCallback(() => cdaService.getCalendar(year), [year]));
  const today = todayISO();

  return (
    <div className="space-y-6">
      <CdaPageHeader
        title="Compliance Calendar"
        description="Every CDA report due for the year, with CDA's extension where one was granted."
      />
      <DataState
        resource={resource}
        endpoints={[`GET ${API_ENDPOINTS.CDA.CALENDAR(year)}`]}
        summary={`The FY ${year} filing deadlines`}
        isEmpty={(d) => d.length === 0}
        emptyMessage="No reporting period is open for this year."
      >
        {(entries) => (
          <Card>
            <CardContent className="overflow-x-auto pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Extended to</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time left</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...entries]
                    .sort((a, b) => effectiveDeadline(a).localeCompare(effectiveDeadline(b)))
                    .map((entry) => (
                      <TableRow key={entry.report_type}>
                        <TableCell>
                          <Link href={REPORT_META[entry.report_type].href} className="font-medium hover:underline">
                            {entry.title}
                          </Link>
                        </TableCell>
                        <TableCell>{formatDate(entry.default_deadline)}</TableCell>
                        <TableCell>{entry.extended_deadline ? formatDate(entry.extended_deadline) : "—"}</TableCell>
                        <TableCell>
                          <ReportStatusBadge status={entry.status} />
                        </TableCell>
                        <TableCell>
                          <DeadlineBadge entry={entry} today={today} />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </DataState>
    </div>
  );
}

export default function Page() {
  return (
    <RouteGuard permission="cda:view" pageName="Compliance Calendar">
      <Calendar />
    </RouteGuard>
  );
}
