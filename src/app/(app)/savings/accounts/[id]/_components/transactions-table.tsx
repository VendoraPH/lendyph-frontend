"use client";

import { useCallback, useState } from "react";
import { Undo2 } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { TablePagination } from "@/components/common/table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { savingsService } from "@/services";
import type { SavingsTransaction } from "@/types";
import { ActionButton } from "../../../_components/action-button";
import { ReverseTransactionDialog } from "../../../_components/reverse-transaction-dialog";
import {
  METHOD_LABELS,
  TRANSACTION_TYPE_LABELS,
  actorName,
  isNilAmount,
  labelOf,
  reversalBlocker,
} from "../../../_lib/savings-rules";

/**
 * One account's ledger, paged on the server, with the server's balance after
 * each line. The parent remounts it (`key`) after a posting.
 */
export function TransactionsTable({ accountId, onChanged }: { accountId: number; onChanged: () => void }) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [reversing, setReversing] = useState<SavingsTransaction | null>(null);

  const fetcher = useCallback(
    () => savingsService.accountTransactions(accountId, { page, per_page: perPage }),
    [accountId, page, perPage],
  );
  const resource = useApiResource(fetcher);

  return (
    <>
      <DataState
        resource={resource}
        endpoints={["GET /savings/accounts/{id}/transactions"]}
        summary="This account's deposits, withdrawals and interest will be listed here once the savings service is connected."
        isEmpty={(res) => res.data.length === 0}
        emptyMessage="No transactions on this account yet."
      >
        {(res) => (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="text-right">Withdrawal</TableHead>
                    <TableHead className="text-right">Deposit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Posted by</TableHead>
                    <TableHead className="w-0">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {res.data.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        {formatDate(t.date)}
                        {t.value_date !== t.date && (
                          <span className="block text-xs text-muted-foreground">
                            Value date {formatDate(t.value_date)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{labelOf(TRANSACTION_TYPE_LABELS, t.type)}</TableCell>
                      <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                      <TableCell>{t.method ? labelOf(METHOD_LABELS, t.method) : "—"}</TableCell>
                      <TableCell className="max-w-64 truncate">{t.remarks ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {isNilAmount(t.debit) ? "" : formatCurrency(t.debit)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {isNilAmount(t.credit) ? "" : formatCurrency(t.credit)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(t.balance_after)}
                      </TableCell>
                      <TableCell>{actorName(t.created_by)}</TableCell>
                      <TableCell>
                        <ActionButton
                          permission="savings:transact"
                          size="sm"
                          variant="ghost"
                          blockedReason={reversalBlocker(t)}
                          onClick={() => setReversing(t)}
                          aria-label={`Reverse ${t.reference}`}
                        >
                          <Undo2 className="h-4 w-4" />
                        </ActionButton>
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
      <ReverseTransactionDialog
        transaction={reversing}
        onOpenChange={(open) => !open && setReversing(null)}
        onRequested={() => {
          resource.refetch();
          onChanged();
        }}
      />
    </>
  );
}
