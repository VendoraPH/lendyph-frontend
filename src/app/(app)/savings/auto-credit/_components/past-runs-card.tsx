"use client";

import { useCallback, useState } from "react";
import { Eye } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { TablePagination } from "@/components/common/table-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { savingsAutoCreditService } from "@/services";
import { pastRunCells } from "../_lib/run-view";
import { PastRunDialog } from "./past-run-dialog";

/** Past auto-credit runs (gap round B7), newest first, each with what it posted and skipped. */
export function PastRunsCard() {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [viewing, setViewing] = useState<number | null>(null);

  const fetcher = useCallback(() => savingsAutoCreditService.runs({ page, per_page: perPage }), [page, perPage]);
  const resource = useApiResource(fetcher);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Past runs</CardTitle>
        <CardDescription>
          Each processed run, newest first. A branch user sees the runs that touched their branches, with those
          accounts&apos; counts and totals.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          endpoints={["GET /savings/auto-credit/runs"]}
          summary="Past auto-credit runs will be listed here once the savings service is connected."
          isEmpty={(res) => res.data.length === 0}
          emptyMessage="No auto-credit run has been processed yet."
        >
          {(res) => (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cycle</TableHead>
                      <TableHead>Posted on</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Settlement account</TableHead>
                      <TableHead className="text-right">Credited</TableHead>
                      <TableHead className="text-right">Skipped</TableHead>
                      <TableHead>Run by</TableHead>
                      <TableHead className="w-0">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {res.data.map((run) => {
                      const cells = pastRunCells(run);
                      return (
                        <TableRow key={run.id}>
                          <TableCell>{cells.cycle}</TableCell>
                          <TableCell>{cells.postedOn}</TableCell>
                          <TableCell>{cells.method}</TableCell>
                          <TableCell>{cells.settlement}</TableCell>
                          <TableCell className="text-right tabular-nums">{cells.posted}</TableCell>
                          <TableCell className="text-right tabular-nums">{cells.skipped}</TableCell>
                          <TableCell>{cells.by}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setViewing(run.id)}
                              aria-label={`View the ${cells.cycle} run`}
                              title="View run"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
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
      <PastRunDialog runId={viewing} onOpenChange={(open) => !open && setViewing(null)} />
    </Card>
  );
}
