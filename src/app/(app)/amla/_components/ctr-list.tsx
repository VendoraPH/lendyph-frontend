"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AmlaFilterField } from "@/components/amla/amla-filter-field";
import { AmlaPager } from "@/components/amla/amla-pager";
import { BranchFilter, branchIdParam } from "@/components/common/branch-filter";
import { DataState } from "@/components/common/data-state";
import { FillSection, PageFill, ScrollBox } from "@/components/common/page-fill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { useBranchFilter, useBranchScopedFilters } from "@/hooks/use-working-branch";
import { amlaMonitoringApi, type AmlaCtrFilters } from "@/lib/amla/monitoring-api";
import { amlaCtrRow } from "@/lib/amla/monitoring-view";
import { once } from "@/lib/amla/once";

type Draft = Pick<AmlaCtrFilters, "from" | "to" | "search">;
const START: Draft = { from: "", to: "", search: "" };

/**
 * Covered transaction (CTR) candidates: one cash transaction above the CTR
 * threshold of the settings in force. Filing them comes later (AMLA-B6), so
 * each stays "Detected". Each Show or page reads once.
 */
export function CtrList() {
  const [draft, setDraft] = useState(START);
  const [branch, setBranch] = useBranchFilter();
  const [applied, setApplied] = useBranchScopedFilters<AmlaCtrFilters>(() => ({ ...START, page: 1 }));
  const fetcher = useMemo(() => once(() => amlaMonitoringApi.ctrCandidates(applied)), [applied]);
  const resource = useApiResource(fetcher);

  return (
    <PageFill>
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">CTR Candidates</h1>
        <p className="text-sm text-muted-foreground">
          Single cash transactions above the covered transaction threshold, still to verify. Exactly the threshold is not
          a candidate, and same-day sums raise a structuring alert instead.
        </p>
      </div>

      <form
        className="flex shrink-0 flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ ...draft, branch_id: branchIdParam(branch), page: 1 });
        }}
      >
        <AmlaFilterField id="amla-ctr-from" label="Transaction from">
          <Input id="amla-ctr-from" type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        </AmlaFilterField>
        <AmlaFilterField id="amla-ctr-to" label="To">
          <Input id="amla-ctr-to" type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </AmlaFilterField>
        <AmlaFilterField id="amla-ctr-search" label="Reference">
          <Input id="amla-ctr-search" type="search" value={draft.search} maxLength={40} className="w-44" onChange={(e) => setDraft({ ...draft, search: e.target.value })} />
        </AmlaFilterField>
        <BranchFilter value={branch} onChange={setBranch} />
        <Button type="submit" variant="outline">
          Show
        </Button>
      </form>

      <FillSection>
        <DataState
          resource={resource}
          summary="Covered transaction candidates, with their amount, threshold and subject."
          endpoints={["GET /amla/ctr-candidates"]}
          isEmpty={(page) => page.meta.total === 0}
          emptyMessage="No CTR candidates match this selection."
          emptyIllustration="allCaughtUp"
        >
          {(page) => (
            <>
              <ScrollBox className="min-h-0 flex-1">
                <Table className="min-w-[52rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.data.map(amlaCtrRow).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-normal">
                          <Link href={row.href} className="font-medium whitespace-nowrap underline-offset-4 hover:underline">
                            {row.reference}
                          </Link>
                          <div className="text-xs text-muted-foreground">{row.movement}</div>
                          {row.notes.map((note) => (
                            <div key={note} className="text-xs text-muted-foreground">
                              {note}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell>{row.date}</TableCell>
                        <TableCell className="whitespace-normal">
                          {row.subject}
                          <div className="text-xs whitespace-nowrap text-muted-foreground">{row.code}</div>
                        </TableCell>
                        <TableCell>{row.branch}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {row.amount}
                          <div className="text-xs text-muted-foreground">{row.threshold}</div>
                        </TableCell>
                        <TableCell>{row.status}</TableCell>
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
