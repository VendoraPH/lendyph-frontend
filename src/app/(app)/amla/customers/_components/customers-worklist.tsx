"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AmlaPager } from "@/components/amla/amla-pager";
import { BranchFilter, branchIdParam } from "@/components/common/branch-filter";
import { DataState } from "@/components/common/data-state";
import { FillSection, PageFill, ScrollBox } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource, usePermission } from "@/hooks";
import { useBranchFilter, useBranchScopedFilters } from "@/hooks/use-working-branch";
import { amlaCddAccess } from "@/lib/amla/cdd-access";
import { amlaCddApi, type AmlaCddFilters } from "@/lib/amla/cdd-api";
import { AMLA_CDD_STATUS_OPTIONS, amlaWorklistRow } from "@/lib/amla/cdd-view";
import { once } from "@/lib/amla/once";

interface Draft {
  type: string;
  status: string;
  search: string;
}

/** The filters a read uses: `branch_id` follows the working branch until it is picked here (`useBranchScopedFilters`). */
interface Applied extends Draft {
  branch_id?: number;
  page: number;
}

const START: Draft = { type: "", status: "", search: "" };

function toApi(applied: Applied): AmlaCddFilters {
  return { type: applied.type, status: applied.status, search: applied.search, branchId: applied.branch_id, page: applied.page };
}

/**
 * The CDD worklist: members in the caller's branches and, for head office,
 * walk-ins, each with the server's CDD status, risk level and next review.
 * Every read is logged by the server, so filters apply on "Show" and each
 * Show or page reads once. The branch follows the header's working branch
 * (multi-branch flag on) until it is picked here, and a header switch goes
 * back to page 1; with the flag off it starts at every branch, as before.
 */
export function CustomersWorklist() {
  const { can } = usePermission();
  const access = amlaCddAccess(can);
  const [draft, setDraft] = useState(START);
  const [branch, setBranch] = useBranchFilter();
  const [applied, setApplied] = useBranchScopedFilters<Applied>(() => ({ ...START, page: 1 }));
  const fetcher = useMemo(() => once(() => amlaCddApi.worklist(toApi(applied))), [applied]);
  const resource = useApiResource(fetcher);

  return (
    <PageFill>
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          Customer due diligence for members{access.walkIns ? " and walk-ins" : " in your branches"}: what is on file,
          the AML risk level and the next review. Statuses are worked out by the server each time the list is read.
        </p>
      </div>

      <form
        className="flex shrink-0 flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ ...draft, branch_id: branchIdParam(branch), page: 1 });
        }}
      >
        {access.walkIns && (
          <div className="space-y-1">
            <Label htmlFor="amla-cdd-type">Customers</Label>
            <NativeSelect id="amla-cdd-type" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              <NativeSelectOption value="">Members and walk-ins</NativeSelectOption>
              <NativeSelectOption value="member">Members</NativeSelectOption>
              <NativeSelectOption value="walk_in">Walk-ins</NativeSelectOption>
            </NativeSelect>
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="amla-cdd-status">CDD status</Label>
          <NativeSelect id="amla-cdd-status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
            <NativeSelectOption value="">Every status</NativeSelectOption>
            {AMLA_CDD_STATUS_OPTIONS.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="amla-cdd-search">Search</Label>
          <Input
            id="amla-cdd-search"
            type="search"
            value={draft.search}
            maxLength={100}
            placeholder="Name or member code"
            className="w-56"
            onChange={(e) => setDraft({ ...draft, search: e.target.value })}
          />
        </div>
        <BranchFilter value={branch} onChange={setBranch} />
        <Button type="submit" variant="outline">
          Show
        </Button>
      </form>

      <FillSection>
        <DataState
          resource={resource}
          summary="Members and walk-ins with their CDD status, risk level and next review."
          endpoints={["GET /amla/cdd/subjects"]}
          isEmpty={(page) => page.data.length === 0}
          emptyMessage="No customers match this selection."
          emptyIllustration="noResults"
        >
          {(page) => (
            <>
              <ScrollBox className="min-h-0 flex-1">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>CDD status</TableHead>
                      <TableHead>Risk level</TableHead>
                      <TableHead>Next review</TableHead>
                      <TableHead>On file</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.data.map(amlaWorklistRow).map((row) => (
                      <TableRow key={row.key}>
                        <TableCell className="whitespace-normal">
                          <Link href={row.href} className="font-medium underline-offset-4 hover:underline">
                            {row.name}
                          </Link>
                          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                            {row.type} · {row.code}
                            {row.imported && <Badge variant="outline">Imported</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>{row.branch}</TableCell>
                        <TableCell>
                          <Badge variant={row.tone}>{row.status}</Badge>
                        </TableCell>
                        <TableCell>{row.risk}</TableCell>
                        <TableCell>{row.nextReview}</TableCell>
                        <TableCell>{row.missing}</TableCell>
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
