"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AmlaFilterField } from "@/components/amla/amla-filter-field";
import { AmlaPager } from "@/components/amla/amla-pager";
import { VISIBLE_SCROLLBAR } from "@/components/amla/visible-scrollbar";
import { DataState } from "@/components/common/data-state";
import { FillSection, ScrollBox } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { amlaCaseApi, type AmlaReportFilters } from "@/lib/amla/case-api";
import { AMLA_REPORT_STATUS_OPTIONS, amlaReportRow } from "@/lib/amla/case-view";
import { once } from "@/lib/amla/once";
import type { AmlaReportType } from "@/types/amla-cases";

interface Props {
  /** One type for the STR and CTR pages; "" lists both (the Regulatory Submissions register). */
  type: AmlaReportType | "";
  /** The filter's id prefix, so two lists on one page never share ids. */
  idPrefix: string;
}

/**
 * CTR and STR records, newest first, as the server scopes them (CTRs in the
 * caller's branches, STRs head office). Each row shows its deadline and
 * filing; a report's fields show on its own page only. Each Show or page
 * reads once.
 */
export function FilingsList({ type, idPrefix }: Props) {
  const start: AmlaReportFilters = { type, status: "", page: 1 };
  const [draft, setDraft] = useState(start.status);
  const [applied, setApplied] = useState(start);
  const fetcher = useMemo(() => once(() => amlaCaseApi.reports(applied)), [applied]);
  const resource = useApiResource(fetcher);

  return (
    <>
      <form
        className="flex shrink-0 flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ type, status: draft, page: 1 });
        }}
      >
        <AmlaFilterField id={`${idPrefix}-status`} label="Status">
          <NativeSelect id={`${idPrefix}-status`} value={draft} onChange={(e) => setDraft(e.target.value)}>
            <NativeSelectOption value="">Every status</NativeSelectOption>
            {AMLA_REPORT_STATUS_OPTIONS.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </AmlaFilterField>
        <Button type="submit" variant="outline">
          Show
        </Button>
      </form>

      <FillSection>
        <DataState
          resource={resource}
          summary="Reports with their status, deadline, preparer, approver and filing."
          endpoints={["GET /amla/reports"]}
          isEmpty={(page) => page.meta.total === 0}
          emptyMessage="No reports match this selection."
          emptyIllustration="allCaughtUp"
        >
          {(page) => (
            <>
              <ScrollBox className={`min-h-0 flex-1 ${VISIBLE_SCROLLBAR}`} tabIndex={0} role="region" aria-label="Reports, scrolls sideways">
                <Table className="min-w-[64rem]">
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>Report</TableHead>
                      <TableHead>About</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Prepared by</TableHead>
                      <TableHead>Approved by</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.data.map(amlaReportRow).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-normal">
                          <Link href={row.href} className="font-medium whitespace-nowrap underline-offset-4 hover:underline">
                            {row.reference}
                          </Link>
                          {type === "" && <div className="text-xs text-muted-foreground">{row.type}</div>}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {row.subject}
                          <div className="text-xs whitespace-nowrap text-muted-foreground">{row.code}</div>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <Badge variant={row.tone}>{row.status}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {row.due}
                          {row.dueNotes.map((note) => (
                            <div key={note} className="text-xs text-muted-foreground">
                              {note}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell>{row.preparedBy}</TableCell>
                        <TableCell>{row.approvedBy}</TableCell>
                        <TableCell>{row.submitted}</TableCell>
                        <TableCell>{row.submissionReference}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollBox>
              <AmlaPager meta={page.meta} onPage={(next) => setApplied((current) => ({ ...current, page: next }))} />
            </>
          )}
        </DataState>
      </FillSection>
    </>
  );
}
