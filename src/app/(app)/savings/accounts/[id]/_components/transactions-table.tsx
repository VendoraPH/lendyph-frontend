"use client";

import { useCallback, useState } from "react";
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
import { TRANSACTION_TYPE_LABELS, toAmount } from "../../../_lib/savings-rules";

/**
 * One account's ledger, newest first, paged on the server, with the server's
 * running balance. The parent remounts it (`key`) after a posting.
 */
export function TransactionsTable({ accountId }: { accountId: number }) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const fetcher = useCallback(
    () => savingsService.transactions(accountId, { page, per_page: perPage }),
    [accountId, page, perPage],
  );
  const resource = useApiResource(fetcher);

  return (
    <DataState
      resource={resource}
      endpoints={["GET /savings/accounts/{id}/transactions"]}
      summary="This account's deposits, withdrawals and interest postings will be listed here once the backend is connected."
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
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Withdrawal</TableHead>
                  <TableHead className="text-right">Deposit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Posted by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {res.data.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{formatDate(t.date)}</TableCell>
                    <TableCell>{TRANSACTION_TYPE_LABELS[t.type] ?? t.type}</TableCell>
                    <TableCell>{t.reference ?? "—"}</TableCell>
                    <TableCell className="max-w-64 truncate">{t.description ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {toAmount(t.debit) ? formatCurrency(t.debit) : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {toAmount(t.credit) ? formatCurrency(t.credit) : ""}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(t.running_balance)}
                    </TableCell>
                    <TableCell>{t.created_by_user?.name ?? "—"}</TableCell>
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
  );
}
