"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { FilePenLine } from "lucide-react";
import { ALL_BRANCHES, branchIdParam } from "@/components/common/branch-filter";
import { DataState } from "@/components/common/data-state";
import { ScrollBox } from "@/components/common/page-fill";
import { TablePagination } from "@/components/common/table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { useBranchFilter } from "@/hooks/use-working-branch";
import { formatCurrency, formatDate } from "@/lib/format";
import { FIT_CLASSES } from "@/lib/page-fill";
import { cn } from "@/lib/utils";
import { savingsService } from "@/services";
import type { PayoutMissingReference } from "@/types";
import { AlignedBranchFilter } from "../../_components/aligned-branch-filter";
import { OptionSelect } from "../../_components/option-select";
import { RecordReferenceDialog, type RecordReferenceTarget } from "../../_components/record-reference-dialog";
import { MISSING_REFERENCE_METHOD_OPTIONS, missingReferenceParams } from "../../_lib/payout-reference";
import { actorName } from "../../_lib/savings-rules";

const PER_PAGE = 25;

function targetOf(row: PayoutMissingReference): RecordReferenceTarget {
  return {
    source: row.source,
    id: row.id,
    number: row.reference,
    description: `${row.kind_label} by ${row.method_label} of ${formatCurrency(row.amount)} on ${formatDate(row.date)}`,
  };
}

/**
 * "Payouts missing a reference" (`GET /savings/payouts/missing-reference`,
 * finish run round 6): non-cash withdrawals, closing payouts and time deposit
 * payouts still without their reference, 25 a page, with "Record reference"
 * where the server allows it.
 */
export function MissingReferenceList() {
  const [branch, setBranch] = useBranchFilter();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [method, setMethod] = useState("all");
  const [page, setPage] = useState(1);
  const [recording, setRecording] = useState<RecordReferenceTarget | null>(null);

  const fetcher = useCallback(
    () =>
      savingsService.payoutsMissingReference(
        missingReferenceParams({
          page,
          branchId: branchIdParam(branch),
          dateFrom,
          dateTo,
          method,
        }),
      ),
    [page, branch, dateFrom, dateTo, method],
  );
  const resource = useApiResource(fetcher);
  const firstPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-end gap-2">
        <OptionSelect
          value={method}
          onChange={firstPage(setMethod)}
          options={MISSING_REFERENCE_METHOD_OPTIONS}
          className="w-40"
        />
        <AlignedBranchFilter value={branch} onChange={firstPage(setBranch)} className="w-48" />
        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          From
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => firstPage(setDateFrom)(e.target.value)}
            className="w-36"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          To
          <Input type="date" value={dateTo} onChange={(e) => firstPage(setDateTo)(e.target.value)} className="w-36" />
        </label>
      </div>

      <DataState
        resource={resource}
        endpoints={["GET /savings/payouts/missing-reference"]}
        summary="Payouts missing a reference will be listed here once the savings service is connected."
        isEmpty={(res) => res.data.length === 0}
        emptyMessage="Every payout by bank transfer, GCash or Maya has its reference."
        emptyIllustration={
          method !== "all" || branch !== ALL_BRANCHES || dateFrom || dateTo ? "noResults" : "emptySavings"
        }
      >
        {(res) => (
          <div className={FIT_CLASSES.section}>
            <div className={cn("rounded-lg border bg-card", FIT_CLASSES.section)}>
              <ScrollBox>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Account or deposit</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Posted by</TableHead>
                      <TableHead className="w-0">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {res.data.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell>{formatDate(row.date)}</TableCell>
                        <TableCell className="min-w-32 whitespace-normal">{row.kind_label}</TableCell>
                        <TableCell className="font-mono text-xs">{row.reference}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.source === "transaction" && row.account_id !== null ? (
                            <Link href={`/savings/accounts/${row.account_id}`} className="hover:underline">
                              {row.account_number ?? "Account"}
                            </Link>
                          ) : row.time_deposit_id !== null ? (
                            <Link href={`/savings/time-deposits/${row.time_deposit_id}`} className="hover:underline">
                              {row.certificate_number ?? "Time deposit"}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="min-w-32 whitespace-normal">
                          {row.member ? `${row.member.name}${row.member.code ? ` (${row.member.code})` : ""}` : "—"}
                        </TableCell>
                        <TableCell>{row.method_label}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.amount)}</TableCell>
                        <TableCell className="min-w-24 whitespace-normal">{actorName(row.posted_by)}</TableCell>
                        <TableCell>
                          {row.can_record_reference ? (
                            <Button size="sm" variant="outline" onClick={() => setRecording(targetOf(row))}>
                              <FilePenLine className="h-4 w-4" />
                              Record reference
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollBox>
            </div>
            <TablePagination
              page={page}
              perPage={PER_PAGE}
              perPageOptions={[PER_PAGE]}
              total={res.meta.total}
              onPageChange={setPage}
              onPerPageChange={() => setPage(1)}
            />
          </div>
        )}
      </DataState>

      <RecordReferenceDialog
        target={recording}
        onOpenChange={(open) => !open && setRecording(null)}
        onRecorded={() => resource.refetch()}
      />
    </>
  );
}
