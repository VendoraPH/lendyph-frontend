"use client";

import { useCallback } from "react";
import { DataState } from "@/components/common/data-state";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { formatCurrency } from "@/lib/format";
import { savingsAutoCreditService } from "@/services";
import { Kpi } from "../../_components/kpi";
import { pastRunCells, skippedListNote } from "../_lib/run-view";
import { AccountCell } from "./run-result";

/** One past run: what it credited (and whether a credit was reversed since) and what it skipped, with why. */
export function PastRunDialog({ runId, onOpenChange }: { runId: number | null; onOpenChange: (open: boolean) => void }) {
  const fetcher = useCallback(() => savingsAutoCreditService.run(runId ?? 0), [runId]);
  const resource = useApiResource(fetcher, runId !== null);

  return (
    <Dialog open={runId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {resource.data && !resource.loading ? `Auto-credit run · ${resource.data.cycle_label}` : "Auto-credit run"}
          </DialogTitle>
          <DialogDescription>Every figure and reason as the server recorded it.</DialogDescription>
        </DialogHeader>
        {runId !== null && (
          <DataState
            resource={resource}
            endpoints={["GET /savings/auto-credit/runs/{run}"]}
            summary="The run's credits and skips will show here once the savings service is connected."
          >
            {(run) => {
              const cells = pastRunCells(run);
              const note = skippedListNote(run);
              return (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Posted on {cells.postedOn} by {cells.by} · {cells.method} · Settlement account {cells.settlement}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Kpi label="Credited" value={cells.posted} />
                    <Kpi label="Skipped" value={cells.skipped} />
                  </div>
                  <section className="space-y-2">
                    <h3 className="text-sm font-medium">
                      Credited <span className="text-muted-foreground">({run.posted.length})</span>
                    </h3>
                    {run.posted.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nothing in your branches was credited on this run.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Account</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Reference</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {run.posted.map((p) => (
                              <TableRow key={`${p.instruction_id}-${p.transaction_id ?? ""}`}>
                                <AccountCell line={p} />
                                <TableCell>
                                  <Badge variant={p.status === "reversed" ? "destructive" : "secondary"}>
                                    {p.status_label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{p.reference ?? "—"}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatCurrency(p.amount)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </section>
                  <section className="space-y-2">
                    <h3 className="text-sm font-medium">
                      Skipped
                      {run.skipped && <span className="text-muted-foreground"> ({run.skipped.length})</span>}
                    </h3>
                    {note ? (
                      <p className="text-sm text-muted-foreground">{note}</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Account</TableHead>
                              <TableHead>Why</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(run.skipped ?? []).map((s) => (
                              <TableRow key={s.instruction_id}>
                                <AccountCell line={s} />
                                <TableCell className="max-w-md whitespace-normal text-sm">{s.reason}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatCurrency(s.amount)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </section>
                </div>
              );
            }}
          </DataState>
        )}
      </DialogContent>
    </Dialog>
  );
}
