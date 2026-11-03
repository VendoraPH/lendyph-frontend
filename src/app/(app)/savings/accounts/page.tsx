"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useApiResource, usePermission } from "@/hooks";
import { RouteGuard, TablePagination } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { PageHeader } from "@/components/common/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { savingsAccountService } from "@/services/savings-account.service";
import {
  AccountFilters,
  EMPTY_ACCOUNT_FILTERS,
  accountFilterParams,
  type AccountFilterValues,
} from "./_components/account-filters";
import { AccountTable } from "./_components/account-table";

const ENDPOINTS = ["GET /savings/accounts", "GET /savings/products"];

function SavingsAccountsContent() {
  const canCreate = usePermission().can("savings:create");
  const [filters, setFilters] = useState<AccountFilterValues>(EMPTY_ACCOUNT_FILTERS);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const fetcher = useCallback(
    () => savingsAccountService.list({ page, per_page: perPage, ...accountFilterParams(filters) }),
    [page, perPage, filters],
  );
  const resource = useApiResource(fetcher);

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Savings accounts"
        description="Find a member's savings account by number, member, product, branch, status or date opened."
        actions={
          canCreate && (
            <Link
              href="/savings/accounts/new"
              className={cn(buttonVariants(), "bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Open account
            </Link>
          )
        }
      />

      <AccountFilters
        value={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
        stats={resource.data?.meta.stats}
      />

      <DataState
        resource={resource}
        summary="Savings accounts with their member, product, branch, balances and status."
        endpoints={ENDPOINTS}
      >
        {(res) => (
          <div className="space-y-4">
            <AccountTable accounts={res.data} />
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

export default function SavingsAccountsPage() {
  return (
    <RouteGuard permission="savings:view" pageName="Savings Accounts">
      <SavingsAccountsContent />
    </RouteGuard>
  );
}
