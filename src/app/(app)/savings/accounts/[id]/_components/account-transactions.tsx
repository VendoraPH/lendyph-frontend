"use client";

import { useCallback, useState } from "react";
import { useApiResource } from "@/hooks";
import { TablePagination } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { DateRangeFilter } from "@/components/common/date-range-filter";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { savingsAccountService } from "@/services/savings-account.service";
import type { Money } from "@/types/savings";
import { ReversalDialogs, type ReversalTarget } from "../../../_components/reversal-dialogs";
import { TransactionRowActions } from "../../../_components/transaction-row-actions";
import { useSavingsReceipt } from "../../../_hooks/use-savings-receipt";
import { useTransactionPermissions } from "../../../_hooks/use-transaction-permissions";
import { TRANSACTION_STATUS_LABEL, TRANSACTION_STATUS_TONE, TRANSACTION_TYPE_LABEL } from "../../../_lib/account-status";
import { ToneBadge } from "../../../_components/tone-badge";

const amount = (v: Money) => (Number(v) ? formatCurrency(v) : "");

/**
 * The account's statement: one page at a time, running balance and totals
 * from the server (never summed here), filtered by date. Each row prints its
 * receipt and offers reversal (and its approval) to those allowed.
 */
export function AccountTransactions({ accountId, onChanged }: { accountId: number; onChanged: () => void }) {
  const [range, setRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [target, setTarget] = useState<ReversalTarget | null>(null);
  const user = useTransactionPermissions();
  const receipt = useSavingsReceipt();

  const fetcher = useCallback(
    () =>
      savingsAccountService.transactions(accountId, {
        page,
        per_page: perPage,
        ...(range.from ? { date_from: range.from } : {}),
        ...(range.to ? { date_to: range.to } : {}),
      }),
    [accountId, page, perPage, range],
  );
  const resource = useApiResource(fetcher);

  return (
    <div className="space-y-4">
      <DateRangeFilter
        label="Transaction date"
        from={range.from}
        to={range.to}
        onChange={(from, to) => {
          setRange({ from, to });
          setPage(1);
        }}
      />
      <DataState
        resource={resource}
        summary="This account's transactions with the running balance after each."
        endpoints={["GET /savings/accounts/{id}/transactions"]}
      >
        {(res) => (
          <div className="space-y-4">
            {(res.meta.opening_balance != null || res.meta.totals) && (
              <dl className="grid grid-cols-2 gap-3 rounded-md border p-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Opening balance</dt>
                  <dd className="font-medium">{formatCurrency(res.meta.opening_balance)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Total debits</dt>
                  <dd className="font-medium">{formatCurrency(res.meta.totals?.total_debit)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Total credits</dt>
                  <dd className="font-medium">{formatCurrency(res.meta.totals?.total_credit)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Closing balance</dt>
                  <dd className="font-medium">{formatCurrency(res.meta.closing_balance)}</dd>
                </div>
              </dl>
            )}
            <Card className="min-w-0 overflow-hidden">
              <CardContent className="overflow-x-auto">
                {res.data.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No transactions in this period.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Processed by</TableHead>
                        <TableHead className="w-0">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {res.data.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="whitespace-nowrap">{formatDate(tx.transaction_date)}</TableCell>
                          <TableCell className="font-mono text-xs">{tx.reference_number}</TableCell>
                          <TableCell>
                            {TRANSACTION_TYPE_LABEL[tx.type] ?? tx.type}
                            {tx.counterparty && (
                              <div className="text-xs text-muted-foreground">{tx.counterparty.account_number}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{amount(tx.debit)}</TableCell>
                          <TableCell className="text-right">{amount(tx.credit)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {tx.running_balance === null ? "—" : formatCurrency(tx.running_balance)}
                          </TableCell>
                          <TableCell>
                            <ToneBadge tone={TRANSACTION_STATUS_TONE[tx.status]}>
                              {TRANSACTION_STATUS_LABEL[tx.status]}
                            </ToneBadge>
                          </TableCell>
                          <TableCell>{tx.processed_by?.name ?? "—"}</TableCell>
                          <TableCell>
                            <TransactionRowActions
                              tx={tx}
                              user={user}
                              onPrint={receipt.print}
                              printing={receipt.printing}
                              onAction={(action, row) => setTarget({ action, tx: row })}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
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
      <ReversalDialogs
        target={target}
        onClose={() => setTarget(null)}
        onDone={() => {
          setTarget(null);
          resource.refetch();
          onChanged();
        }}
      />
    </div>
  );
}
