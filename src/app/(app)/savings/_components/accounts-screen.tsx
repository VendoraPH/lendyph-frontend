"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Settings2 } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { PermissionGate } from "@/components/common/permission-gate";
import { TablePagination } from "@/components/common/table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { statusTabs } from "../_lib/savings-rules";
import { AccountStatusBadge } from "./account-status-badge";
import { Kpi } from "./kpi";
import { OpenAccountDialog } from "./open-account-dialog";

export function AccountsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [opening, setOpening] = useState(false);

  const fetcher = useCallback(
    () =>
      savingsService.accounts({
        page,
        per_page: perPage,
        search: search || undefined,
        status: status === "all" ? undefined : status,
      }),
    [page, perPage, search, status],
  );
  const resource = useApiResource(fetcher);
  const meta = resource.data?.meta;
  const tabs = statusTabs(meta?.stats);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Savings Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Members&apos; passbook savings: balances, deposits and withdrawals.
          </p>
        </div>
        <div className="flex gap-2">
          <PermissionGate permission="savings:settings">
            <Button variant="outline" nativeButton={false} render={<Link href="/savings/products" />}>
              <Settings2 className="h-4 w-4" /> Products
            </Button>
          </PermissionGate>
          <PermissionButton permission="savings:create" onClick={() => setOpening(true)}>
            <Plus className="h-4 w-4" /> Open account
          </PermissionButton>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Accounts" value={meta ? String(tabs[0].count) : "—"} />
        <Kpi label="Active" value={meta ? String(meta.stats?.active ?? 0) : "—"} />
        <Kpi
          label={search || status !== "all" ? "Balance (matching)" : "Total balance"}
          value={meta?.totals ? formatCurrency(meta.totals.total_balance) : "—"}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(String(v));
            setPage(1);
          }}
        >
          <TabsList>
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
                {meta && <span className="ml-1 text-xs text-muted-foreground">{t.count}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <form
          className="flex w-full gap-2 sm:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchDraft.trim());
            setPage(1);
          }}
        >
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Account no., member name or code"
            aria-label="Search accounts"
            className="sm:w-72"
          />
          <Button type="submit" variant="outline" size="icon" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <DataState
        resource={resource}
        endpoints={["GET /savings/accounts"]}
        summary="Savings accounts will be listed here, with balances and status, once the backend is connected."
        isEmpty={(res) => res.data.length === 0}
        emptyMessage={search ? "No account matches this search." : "No savings accounts yet."}
      >
        {(res) => (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account no.</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead>Last activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {res.data.map((a) => (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/savings/accounts/${a.id}`)}
                    >
                      <TableCell className="font-medium">
                        <Link href={`/savings/accounts/${a.id}`} onClick={(e) => e.stopPropagation()}>
                          {a.account_number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {a.borrower_name ?? "—"}
                        {a.borrower_code && (
                          <span className="block text-xs text-muted-foreground">{a.borrower_code}</span>
                        )}
                      </TableCell>
                      <TableCell>{a.product.name}</TableCell>
                      <TableCell>{a.branch_name ?? "—"}</TableCell>
                      <TableCell>
                        <AccountStatusBadge status={a.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(a.balance)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(a.available_balance)}
                      </TableCell>
                      <TableCell>{a.last_transaction_at ? formatDate(a.last_transaction_at) : "—"}</TableCell>
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

      <OpenAccountDialog
        open={opening}
        onOpenChange={setOpening}
        onOpened={(account) => router.push(`/savings/accounts/${account.id}`)}
      />
    </div>
  );
}
