"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { FileBarChart } from "lucide-react";
import { useApiResource, usePermission } from "@/hooks";
import { RouteGuard, TablePagination } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { PageHeader } from "@/components/common/page-header";
import { buttonVariants } from "@/components/ui/button";
import { countOrDash, currencyOrDash } from "@/lib/report-format";
import { savingsTransactionService } from "@/services/savings-transaction.service";
import { TransactionTable } from "../_components/transaction-table";
import {
  EMPTY_TRANSACTION_FILTERS,
  TransactionFilters,
  transactionFilterParams,
  type TransactionFilterValues,
} from "./_components/transaction-filters";

function SavingsTransactionsContent() {
  const { can } = usePermission();
  const [filters, setFilters] = useState<TransactionFilterValues>(EMPTY_TRANSACTION_FILTERS);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const fetcher = useCallback(
    () => savingsTransactionService.list({ page, per_page: perPage, ...transactionFilterParams(filters) }),
    [page, perPage, filters],
  );
  const resource = useApiResource(fetcher);
  // Export lives in the Savings reports (Excel, PDF, Word, CSV).
  const canExport = can("savings:export") && can("reports:view");

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Savings transactions"
        description="Every deposit, withdrawal, transfer, interest credit and reversal across savings accounts."
        actions={
          canExport && (
            <Link href="/reports#savings" className={buttonVariants({ variant: "outline" })}>
              <FileBarChart className="mr-2 h-4 w-4" />
              Savings reports
            </Link>
          )
        }
      />

      <TransactionFilters
        value={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />

      <DataState
        resource={resource}
        summary="Savings transactions across accounts, with totals for the filter from the server."
        endpoints={["GET /savings/transactions"]}
      >
        {(res) => (
          <div className="space-y-4">
            {/* The server's totals for the whole filter; "—" when it sent none, never a page sum. */}
            <dl className="grid grid-cols-2 gap-3 rounded-md border p-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Transactions</dt>
                <dd className="font-medium">{countOrDash(res.meta.total)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Total debits</dt>
                <dd className="font-medium">{currencyOrDash(res.meta.totals?.total_debit)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Total credits</dt>
                <dd className="font-medium">{currencyOrDash(res.meta.totals?.total_credit)}</dd>
              </div>
            </dl>
            <TransactionTable
              rows={res.data}
              showAccount
              emptyText="No savings transactions match these filters."
              onChanged={resource.refetch}
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

export default function SavingsTransactionsPage() {
  return (
    <RouteGuard permission="savings:view" pageName="Savings Transactions">
      <SavingsTransactionsContent />
    </RouteGuard>
  );
}
