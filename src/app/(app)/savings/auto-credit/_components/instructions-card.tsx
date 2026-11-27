"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { TablePagination } from "@/components/common/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiResource } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatCurrency, formatDate } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { savingsAutoCreditService } from "@/services";
import type { SavingsAutoCreditInstruction } from "@/types/savings-servicing";
import { ActionButton } from "../../_components/action-button";
import { deleteBlocker } from "../_lib/instruction-form";
import { InstructionDialog } from "./instruction-dialog";

const ACTIVE_TABS = [
  { value: "1", label: "Active" },
  { value: "0", label: "Inactive" },
  { value: "all", label: "All" },
] as const;

/** Members' standing instructions: list, add, edit, deactivate, and delete one that never credited. */
export function InstructionsCard() {
  const [active, setActive] = useState<string>("1");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [editing, setEditing] = useState<SavingsAutoCreditInstruction | null>(null);
  const [adding, setAdding] = useState(false);
  const { submitting, run } = useSubmitGuard();

  const fetcher = useCallback(
    () =>
      savingsAutoCreditService.instructions({
        page,
        per_page: perPage,
        active: active === "all" ? undefined : active,
      }),
    [page, perPage, active],
  );
  const resource = useApiResource(fetcher);

  const setActiveFlag = (i: SavingsAutoCreditInstruction, next: boolean) => {
    run(() => savingsAutoCreditService.update(i.id, { active: next }))
      ?.then(() => {
        notifySuccess(next ? "Instruction reactivated" : "Instruction deactivated", i.account_number ?? undefined);
        resource.refetch();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't change the instruction."));
  };

  const remove = (i: SavingsAutoCreditInstruction) => {
    run(() => savingsAutoCreditService.remove(i.id))
      ?.then(() => {
        notifySuccess("Instruction deleted", i.account_number ?? undefined);
        resource.refetch();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't delete the instruction."));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-base">Instructions</CardTitle>
          <CardDescription>One active instruction per account per cycle (the 15th, the 30th).</CardDescription>
        </div>
        <PermissionButton permission="savings:post" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add instruction
        </PermissionButton>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs
          value={active}
          onValueChange={(v) => {
            setActive(String(v));
            setPage(1);
          }}
        >
          <TabsList>
            {ACTIVE_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <DataState
          resource={resource}
          endpoints={["GET /savings/auto-credit/instructions"]}
          summary="Members' auto-credit instructions will be listed here once the savings service is connected."
          isEmpty={(res) => res.data.length === 0}
          emptyMessage={active === "1" ? "No active auto-credit instructions." : "No instructions here."}
        >
          {(res) => (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Authorised</TableHead>
                      <TableHead>Last credited</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-0">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {res.data.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>
                          <Link href={`/savings/accounts/${i.account_id}`} className="font-mono text-xs hover:underline">
                            {i.account_number ?? `Account #${i.account_id}`}
                          </Link>
                          <span className="block text-xs text-muted-foreground">
                            {i.borrower_name ?? "—"}
                            {i.branch_name && ` · ${i.branch_name}`}
                          </span>
                        </TableCell>
                        <TableCell>{i.schedule_label}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(i.amount)}</TableCell>
                        <TableCell>
                          {i.authorised_by ?? "—"}
                          {i.authorised_on && (
                            <span className="block text-xs text-muted-foreground">{formatDate(i.authorised_on)}</span>
                          )}
                        </TableCell>
                        <TableCell>{i.last_cycle_date ? formatDate(i.last_cycle_date) : "Never"}</TableCell>
                        <TableCell>
                          <Badge variant={i.active ? "secondary" : "outline"}>{i.active ? "Active" : "Inactive"}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex justify-end gap-1">
                            <PermissionButton
                              permission="savings:post"
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditing(i)}
                              aria-label={`Edit the instruction on ${i.account_number ?? i.account_id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </PermissionButton>
                            <PermissionButton
                              permission="savings:post"
                              size="sm"
                              variant="ghost"
                              disabled={submitting}
                              onClick={() => setActiveFlag(i, !i.active)}
                              aria-label={`${i.active ? "Deactivate" : "Reactivate"} the instruction on ${i.account_number ?? i.account_id}`}
                              title={i.active ? "Deactivate" : "Reactivate"}
                            >
                              <Power className="h-4 w-4" />
                            </PermissionButton>
                            <ActionButton
                              permission="savings:post"
                              size="sm"
                              variant="ghost"
                              blockedReason={deleteBlocker(i)}
                              disabled={submitting}
                              onClick={() => remove(i)}
                              aria-label={`Delete the instruction on ${i.account_number ?? i.account_id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </ActionButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
      <InstructionDialog
        open={adding || editing !== null}
        instruction={editing}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false);
            setEditing(null);
          }
        }}
        onSaved={() => resource.refetch()}
      />
    </Card>
  );
}
