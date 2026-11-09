"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { TablePagination } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccountingResource } from "@/hooks";
import { accountingService } from "@/services";
import type { AllowancePostingPage } from "@/types";
import { DataState } from "../../_components/data-state";
import { DASH, HISTORY_PER_PAGE, historyQuery, historyRows, historyTotal } from "../_lib/allowance";

const PER_PAGE_OPTIONS = [25, 50, 100] as const;

/**
 * Every posting, newest first, paged on the server, with the total over every
 * row. The page remounts it after a posting, so it reads afresh from page 1.
 */
export function AllowanceHistory() {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(HISTORY_PER_PAGE);
  const fetcher = useCallback(
    () => accountingService.allowancePostingsPage(historyQuery(page, perPage)),
    [page, perPage],
  );
  const resource = useAccountingResource<AllowancePostingPage>(fetcher);

  return (
    <section className="space-y-3" aria-labelledby="allowance-history">
      <h2 id="allowance-history" className="text-lg font-semibold">
        Postings
      </h2>
      <DataState
        resource={resource}
        summary="Every allowance posting, by branch, with its journal and who posted it."
        endpoints={["GET /accounting/allowance/postings"]}
        isEmpty={(result) => result.data.length === 0}
        emptyMessage="The allowance hasn't been posted yet."
      >
        {(result) => (
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>As of</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead className="text-right">Required</TableHead>
                      <TableHead className="text-right">Previous balance</TableHead>
                      <TableHead className="text-right">Adjustment</TableHead>
                      <TableHead>Journal</TableHead>
                      <TableHead>Posted by</TableHead>
                      <TableHead>Posted on</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRows(result).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm">{row.asOf}</TableCell>
                        <TableCell className="text-sm">{row.branch}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{row.required}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {row.previousBalance}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{row.adjustment}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.journal ? (
                            <Link href={row.journal.href} className="underline underline-offset-2">
                              {row.journal.label}
                            </Link>
                          ) : (
                            DASH
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{row.postedBy}</TableCell>
                        <TableCell className="text-sm">{row.postedAt}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="font-medium">
                        Total adjustment, every posting
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {historyTotal(result)}
                      </TableCell>
                      <TableCell colSpan={3} />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
              <TablePagination
                page={page}
                perPage={perPage}
                total={result.meta.total}
                perPageOptions={PER_PAGE_OPTIONS}
                onPageChange={setPage}
                onPerPageChange={(next) => {
                  setPage(1);
                  setPerPage(next);
                }}
              />
            </CardContent>
          </Card>
        )}
      </DataState>
    </section>
  );
}
