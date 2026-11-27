"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { PermissionGate } from "@/components/common";
import { TablePagination } from "@/components/common/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { accountingService } from "@/services";
import type { YearClose } from "@/types";
import { DataState } from "../../_components/data-state";
import {
  YEAR_CLOSE_PER_PAGE,
  historyPaging,
  historyQuery,
  historyRowView,
  historyTotal,
  latestClosedId,
} from "../_lib/year-close";
import { ReopenYearDialog } from "./reopen-year-dialog";

interface YearCloseHistoryProps {
  /** The closes the screen read for the whole list (newest first), to find the latest closed year. */
  closes: YearClose[];
  onChanged: () => void;
}

export function YearCloseHistory({ closes, onChanged }: YearCloseHistoryProps) {
  const [page, setPage] = useState(1);
  const fetcher = useCallback(() => accountingService.yearClosesPage(historyQuery(page)), [page]);
  const history = useAccountingResource(fetcher);
  const [reopening, setReopening] = useState<YearClose | null>(null);
  // From the whole list, not this page: only the latest closed year can be reopened.
  const reopenableId = latestClosedId(closes);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Year-end close history</CardTitle>
      </CardHeader>
      <CardContent>
        <DataState
          resource={history}
          summary="Each year-end close: its closing entries, who closed it, and any reopening with its reason."
          endpoints={["GET /accounting/year-closes", "POST /accounting/year-closes/{id}/reopen"]}
          isEmpty={(res) => res.data.length === 0}
          emptyMessage="No year has been closed yet."
        >
          {(res) => {
            const paging = historyPaging(res);
            return (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Year</TableHead>
                        <TableHead className="w-28">Status</TableHead>
                        <TableHead className="w-40 text-right">Net surplus</TableHead>
                        <TableHead>Closing entries</TableHead>
                        <TableHead className="w-56">Closed</TableHead>
                        <TableHead className="w-64">Reopened</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {res.data.map((row) => {
                        const view = historyRowView(row);
                        return (
                          <TableRow key={view.id} className="align-top">
                            <TableCell className="font-medium">{view.year}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  row.status === "closed"
                                    ? "border-slate-500/30 bg-slate-500/10 text-slate-700"
                                    : "border-amber-500/30 bg-amber-500/10 text-amber-700"
                                }
                              >
                                {view.status}
                              </Badge>
                            </TableCell>
                            <TableCell className={cn("text-right tabular-nums", view.loss && "text-destructive")}>
                              {view.netSurplus}
                            </TableCell>
                            <TableCell>
                              {view.entries.length === 0 ? (
                                <span className="text-sm text-muted-foreground">—</span>
                              ) : (
                                <ul className="space-y-1 text-sm">
                                  {view.entries.map((entry) => (
                                    <li key={entry.key} className="flex flex-wrap gap-x-2">
                                      <span>{entry.branch}</span>
                                      <Link href={entry.href} className="font-mono text-xs text-primary underline-offset-2 hover:underline">
                                        {entry.journalNo}
                                      </Link>
                                      <span className="tabular-nums text-muted-foreground">{entry.netSurplus}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {view.closedAt} · {view.closedBy}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {view.reopenedAt ? (
                                <div className="space-y-1">
                                  <p>
                                    {view.reopenedAt} · {view.reopenedBy}
                                  </p>
                                  {view.reopenReason && <p className="text-foreground">{view.reopenReason}</p>}
                                </div>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {view.id === reopenableId && (
                                <PermissionGate permission="accounting:close">
                                  <Button size="sm" variant="ghost" onClick={() => setReopening(row)}>
                                    Reopen
                                  </Button>
                                </PermissionGate>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2} className="font-medium">
                          Total, every close
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{historyTotal(res)}</TableCell>
                        <TableCell colSpan={4} />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
                <TablePagination
                  page={paging.page}
                  perPage={paging.perPage}
                  total={paging.total}
                  perPageOptions={[YEAR_CLOSE_PER_PAGE]}
                  onPageChange={setPage}
                  onPerPageChange={() => setPage(1)}
                />
              </div>
            );
          }}
        </DataState>
      </CardContent>

      <ReopenYearDialog
        row={reopening}
        onClose={() => setReopening(null)}
        onReopened={() => {
          setReopening(null);
          onChanged();
        }}
      />
    </Card>
  );
}
