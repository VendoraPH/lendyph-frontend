"use client";

import { useCallback, useState } from "react";
import { DataState } from "@/components/common/data-state";
import { DisabledReason } from "@/components/common/disabled-reason";
import { ReasonDialog } from "@/components/common/reason-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermission } from "@/hooks";
import { formatDateTime } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { cicService } from "@/services";
import type { CicLoanOverride, CicProductMappingCodeLists } from "@/types/cic";
import { recordTypeLabel, whenBy } from "@/app/(app)/cic/_lib/labels";
import { CicPager } from "@/app/(app)/cic/_components/cic-pager";
import { usePagedResource } from "@/app/(app)/cic/_hooks/use-paged-resource";
import { OverrideDialog } from "./override-dialog";
import { overrideRemoveBlockedReason } from "../_lib/override-contract-no";

const code = (c: string | null, label: string | null) => (c ? `${c}${label ? ` · ${label}` : ""}` : "The product's");

/** Loans reported with their own CIC codes instead of their product's; every change takes a reason. */
export function LoanOverrideCard({ codeLists }: { codeLists: CicProductMappingCodeLists }) {
  const { can } = usePermission();
  const canWrite = can("cic:prepare");
  const load = useCallback((page: number) => cicService.loanOverridesPage(page), []);
  const { resource, pager } = usePagedResource(load);
  const [dialog, setDialog] = useState<{ editing: CicLoanOverride | null } | null>(null);
  const [removing, setRemoving] = useState<CicLoanOverride | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Loan Overrides</CardTitle>
          <CardDescription>A loan whose structure differs from its product&apos;s mapping can carry its own codes.</CardDescription>
        </div>
        {canWrite && <Button onClick={() => setDialog({ editing: null })}>Add Override</Button>}
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          summary="Loans reported to CIC with their own codes, and why."
          endpoints={["GET /cic/loan-overrides"]}
          isEmpty={(d) => d.data.length === 0}
          emptyMessage="No loan has its own CIC codes."
        >
          {(d) => (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loan</TableHead>
                      <TableHead>Record</TableHead>
                      <TableHead>Contract type</TableHead>
                      <TableHead>Transaction type</TableHead>
                      <TableHead className="whitespace-normal">CIC contract number</TableHead>
                      <TableHead>Reason</TableHead>
                      {canWrite && <TableHead />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.data.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="whitespace-normal">
                          <span className="font-medium">{o.loan.display_number}</span>
                          {o.loan.loan_product && (
                            <span className="block text-xs text-muted-foreground">{o.loan.loan_product.name}</span>
                          )}
                        </TableCell>
                        <TableCell>{o.record_type ? recordTypeLabel(o.record_type) : "The product's"}</TableCell>
                        <TableCell className="whitespace-normal">{code(o.contract_type, o.contract_type_label)}</TableCell>
                        <TableCell className="whitespace-normal">{code(o.transaction_type, o.transaction_type_label)}</TableCell>
                        <TableCell className="max-w-48 whitespace-normal">
                          {o.contract_no ? (
                            <>
                              <span className="break-all font-mono text-xs">{o.contract_no}</span>
                              {o.contract_no_reported && (
                                <span className="block text-xs text-muted-foreground">Reported to CIC</span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">The Loan No.</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-72 whitespace-normal text-sm">
                          {o.reason}
                          <span className="block text-xs text-muted-foreground">
                            {whenBy(o.updated_at ?? o.created_at, o.updated_by ?? o.created_by, formatDateTime)}
                          </span>
                        </TableCell>
                        {canWrite && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setDialog({ editing: o })}>
                                Edit
                              </Button>
                              <DisabledReason reason={overrideRemoveBlockedReason(o)}>
                                <Button
                                  variant="outline"
                                  disabled={o.contract_no_reported}
                                  onClick={() => setRemoving(o)}
                                >
                                  Remove
                                </Button>
                              </DisabledReason>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <CicPager pager={pager} total={d.meta.total} />
            </>
          )}
        </DataState>
      </CardContent>
      <OverrideDialog
        open={dialog !== null}
        editing={dialog?.editing ?? null}
        codeLists={codeLists}
        onOpenChange={(open) => !open && setDialog(null)}
        onSaved={resource.refetch}
      />
      <ReasonDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove the Loan Override"
        description={`${removing?.loan.display_number ?? "The loan"} goes back to its product's CIC mapping.`}
        confirmLabel="Remove Override"
        destructive
        onConfirm={async (reason) => {
          if (!removing) return;
          await cicService.deleteLoanOverride(removing.id, reason);
          notifySuccess("Loan override removed.");
          resource.refetch();
        }}
      />
    </Card>
  );
}
