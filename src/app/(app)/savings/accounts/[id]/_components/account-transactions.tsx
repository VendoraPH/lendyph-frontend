"use client";

import { useCallback, useState } from "react";
import { useApiResource } from "@/hooks";
import { TablePagination } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { DateRangeFilter } from "@/components/common/date-range-filter";
import { formatCurrency } from "@/lib/format";
import { savingsAccountService } from "@/services/savings-account.service";
import { TransactionTable } from "../../../_components/transaction-table";

/**
 * The account's statement: one page at a time, running balance and totals
 * from the server (never summed here), filtered by date.
 */
export function AccountTransactions({ accountId, onChanged }: { accountId: number; onChanged: () => void }) {
  const [range, setRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

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
            <TransactionTable
              rows={res.data}
              emptyText="No transactions in this period."
              onChanged={() => {
                resource.refetch();
                onChanged();
              }}
            />
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
    </div>
  );
}
