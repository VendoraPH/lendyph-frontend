"use client";

import { useCallback, useState } from "react";
import { FileText, Printer, Undo2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { useApiResource } from "@/hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { savingsService } from "@/services";
import { isReceiptTransaction } from "@/lib/printables/templates/savings-receipt";
import type { SavingsAccount, SavingsTransaction } from "@/types";
import { ActionButton } from "../../../_components/action-button";
import { ReverseTransactionDialog } from "../../../_components/reverse-transaction-dialog";
import {
  METHOD_LABELS,
  TRANSACTION_TYPE_LABELS,
  isNilAmount,
  labelOf,
  reversalBlocker,
} from "../../../_lib/savings-rules";
import { printSavingsReceipt } from "../_lib/print-receipt";
import { postedByText } from "../_lib/account-details";
import { WITHDRAWAL_SLIP } from "@/lib/savings/documents";
import { printSavingsDocument } from "@/lib/savings/print-document";

/**
 * One account's ledger, paged on the server, with the server's balance after
 * each line. The parent remounts it (`key`) after a posting. A deposit or
 * withdrawal line prints its receipt.
 */
export function TransactionsTable({ account, onChanged }: { account: SavingsAccount; onChanged: () => void }) {
  const accountId = account.id;
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [reversing, setReversing] = useState<SavingsTransaction | null>(null);
  const [printingId, setPrintingId] = useState<number | null>(null);

  const printReceipt = (t: SavingsTransaction) => {
    if (!isReceiptTransaction(t)) return;
    setPrintingId(t.id);
    printSavingsReceipt(account, t).then(() => setPrintingId(null));
  };

  const printSlip = (t: SavingsTransaction) => {
    setPrintingId(t.id);
    printSavingsDocument(WITHDRAWAL_SLIP, t.id).then(() => setPrintingId(null));
  };

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
                      <TableCell>
                        {postedByText(t).primary}
                        {postedByText(t).secondary && (
                          <span className="block text-xs text-muted-foreground">{postedByText(t).secondary}</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {isReceiptTransaction(t) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={printingId === t.id}
                            onClick={() => printReceipt(t)}
                            aria-label={`Print receipt for ${t.reference}`}
                            title="Print receipt"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        )}
                        {t.type === "withdrawal" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={printingId === t.id}
                            onClick={() => printSlip(t)}
                            aria-label={`Print withdrawal slip for ${t.reference}`}
                            title="Print withdrawal slip"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
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
