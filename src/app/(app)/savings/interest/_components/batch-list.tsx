"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useApiResource } from "@/hooks";
import { TablePagination } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { savingsInterestService } from "@/services/savings-interest.service";
import type { InterestBatch, InterestBatchStatus } from "@/types/savings";
import { ToneBadge } from "../../_components/tone-badge";
import { BATCH_STATUS_LABEL, BATCH_STATUS_TONE } from "../../_lib/interest-batch";

type StatusFilter = "all" | InterestBatchStatus;
const STATUSES = Object.keys(BATCH_STATUS_LABEL) as InterestBatchStatus[];

function BatchTable({ batches }: { batches: InterestBatch[] }) {
  if (batches.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No interest batches yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead className="text-right">Accounts</TableHead>
            <TableHead className="text-right">Interest</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((b) => (
            <TableRow key={b.id}>
              <TableCell>
                <Link href={`/savings/interest/${b.id}`} className="font-mono underline-offset-2 hover:underline">
                  {b.reference_number}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatDate(b.period_from)} – {formatDate(b.period_to)}
              </TableCell>
              <TableCell>{b.product?.name ?? "All products"}</TableCell>
              <TableCell>{b.branch?.name ?? "All branches"}</TableCell>
              <TableCell className="text-right tabular-nums">{b.totals.eligible_accounts}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(b.totals.total_interest)}</TableCell>
              <TableCell>
                <ToneBadge tone={BATCH_STATUS_TONE[b.status]}>{BATCH_STATUS_LABEL[b.status]}</ToneBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Saved interest batches, newest first, by status. */
export function BatchList() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const fetcher = useCallback(
    () =>
      savingsInterestService.listBatches({
        page,
        per_page: perPage,
        ...(status === "all" ? {} : { status }),
      }),
    [page, perPage, status],
  );
  const resource = useApiResource(fetcher);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Interest batches</CardTitle>
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(v as StatusFilter);
            setPage(1);
          }}
        >
          <TabsList className="flex-wrap">
            <TabsTrigger value="all">All</TabsTrigger>
            {STATUSES.map((s) => (
              <TabsTrigger key={s} value={s}>
                {BATCH_STATUS_LABEL[s]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          summary="Interest batches with their period, scope, total and status."
          endpoints={["GET /savings/interest/batches"]}
        >
          {(res) => (
            <div className="space-y-4">
              <BatchTable batches={res.data} />
              <TablePagination
                page={page}
                perPage={perPage}
                total={res.meta.total}
                onPageChange={setPage}
                onPerPageChange={(n) => {
                  setPerPage(n);
                  setPage(1);
                }}
              />
            </div>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}
