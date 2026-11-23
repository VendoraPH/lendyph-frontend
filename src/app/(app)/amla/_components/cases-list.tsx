"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AmlaFilterField } from "@/components/amla/amla-filter-field";
import { AmlaPager } from "@/components/amla/amla-pager";
import { VISIBLE_SCROLLBAR } from "@/components/amla/visible-scrollbar";
import { DataState } from "@/components/common/data-state";
import { FillSection, PageFill, ScrollBox } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { amlaCaseApi, type AmlaCaseFilters } from "@/lib/amla/case-api";
import { AMLA_CASE_STATUS_OPTIONS, amlaCaseRow } from "@/lib/amla/case-view";
import { once } from "@/lib/amla/once";

const START: AmlaCaseFilters = { status: "", search: "", page: 1 };

/**
 * Compliance cases, newest first. Cases are head office's, so there is no
 * branch filter. The server logs each read, so filters apply on "Show" and
 * each Show or page reads once.
 */
export function CasesList() {
  const [draft, setDraft] = useState(START);
  const [applied, setApplied] = useState(START);
  const fetcher = useMemo(() => once(() => amlaCaseApi.cases(applied)), [applied]);
  const resource = useApiResource(fetcher);

  return (
    <PageFill>
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Compliance Cases</h1>
        <p className="text-sm text-muted-foreground">
          Investigations opened from alerts. Each ends in an authorized decision: no STR, with its reason, or suspicion
          established, which starts the STR deadline.
        </p>
      </div>

      <form
        className="flex shrink-0 flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ ...draft, page: 1 });
        }}
      >
        <AmlaFilterField id="amla-cases-status" label="Status">
          <NativeSelect id="amla-cases-status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
            <NativeSelectOption value="">Every status</NativeSelectOption>
            {AMLA_CASE_STATUS_OPTIONS.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </AmlaFilterField>
        <AmlaFilterField id="amla-cases-search" label="Reference">
          <Input id="amla-cases-search" type="search" value={draft.search} maxLength={40} className="w-44" onChange={(e) => setDraft({ ...draft, search: e.target.value })} />
        </AmlaFilterField>
        <Button type="submit" variant="outline">
          Show
        </Button>
      </form>

      <FillSection>
        <DataState
          resource={resource}
          summary="Compliance cases, with their subject, status and who is investigating."
          endpoints={["GET /amla/cases"]}
          isEmpty={(page) => page.meta.total === 0}
          emptyMessage="No cases match this selection. Cases are opened from an alert."
          emptyIllustration="allCaughtUp"
        >
          {(page) => (
            <>
              <ScrollBox className={`min-h-0 flex-1 ${VISIBLE_SCROLLBAR}`} tabIndex={0} role="region" aria-label="Compliance cases, scrolls sideways">
                <Table className="min-w-[56rem]">
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>Case</TableHead>
                      <TableHead>About</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Investigating</TableHead>
                      <TableHead>Opened</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.data.map(amlaCaseRow).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-normal">
                          <Link href={row.href} className="font-medium whitespace-nowrap underline-offset-4 hover:underline">
                            {row.reference}
                          </Link>
                          <div className="text-xs text-muted-foreground">{row.title}</div>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {row.subject}
                          <div className="text-xs whitespace-nowrap text-muted-foreground">{row.code}</div>
                        </TableCell>
                        <TableCell>{row.branch}</TableCell>
                        <TableCell className="whitespace-normal">
                          <Badge variant={row.tone}>{row.status}</Badge>
                        </TableCell>
                        <TableCell>{row.assignee}</TableCell>
                        <TableCell>
                          {row.opened}
                          <div className="text-xs text-muted-foreground">by {row.openedBy}</div>
                        </TableCell>
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
    </PageFill>
  );
}
