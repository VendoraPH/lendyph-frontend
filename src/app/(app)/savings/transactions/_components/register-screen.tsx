"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Search, Undo2 } from "lucide-react";
import { BranchFilter, ALL_BRANCHES, branchIdParam } from "@/components/common/branch-filter";
import { DataState } from "@/components/common/data-state";
import { TablePagination } from "@/components/common/table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { SavingsTransaction, SavingsTransactionType } from "@/types";
import { ActionButton } from "../../_components/action-button";
import { OptionSelect } from "../../_components/option-select";
import { ReverseTransactionDialog } from "../../_components/reverse-transaction-dialog";
import {
  METHOD_LABELS,
  TRANSACTION_TYPE_LABELS,
  actorName,
  isNilAmount,
  labelOf,
  reversalBlocker,
} from "../../_lib/savings-rules";

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  ...(Object.keys(TRANSACTION_TYPE_LABELS) as SavingsTransactionType[]).map((t) => ({
    value: t,
    label: TRANSACTION_TYPE_LABELS[t],
  })),
];

/** Every savings account's transactions (`GET /savings/transactions`), paged on the server. */
export function RegisterScreen() {
  const [type, setType] = useState("all");
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [reversing, setReversing] = useState<SavingsTransaction | null>(null);

  const fetcher = useCallback(
    () =>
      savingsService.transactions({
        page,
        per_page: perPage,
        search: search || undefined,
        type: type === "all" ? undefined : type,
        branch_id: branchIdParam(branch),
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
    [page, perPage, search, type, branch, dateFrom, dateTo],
  );
  const resource = useApiResource(fetcher);
  const firstPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Savings Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Every posted savings line across accounts. A reversal is requested here and posts once another user approves it.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <OptionSelect value={type} onChange={firstPage(setType)} options={TYPE_OPTIONS} className="w-48" />
        <BranchFilter value={branch} onChange={firstPage(setBranch)} className="w-56" />
        <label className="text-xs text-muted-foreground">
          From
          <Input type="date" value={dateFrom} onChange={(e) => firstPage(setDateFrom)(e.target.value)} className="w-40" />
        </label>
        <label className="text-xs text-muted-foreground">
          To
          <Input type="date" value={dateTo} onChange={(e) => firstPage(setDateTo)(e.target.value)} className="w-40" />
        </label>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchDraft.trim());
            setPage(1);
          }}
        >
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Reference, account no. or member"
            aria-label="Search transactions"
            className="sm:w-64"
          />
          <Button type="submit" variant="outline" size="icon" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <DataState
        resource={resource}
        endpoints={["GET /savings/transactions"]}
        summary="Savings transactions will be listed here once the savings service is connected."
        isEmpty={(res) => res.data.length === 0}
        emptyMessage="No transactions match these filters."
      >
        {(res) => (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Out</TableHead>
                    <TableHead className="text-right">In</TableHead>
                    <TableHead>Posted by</TableHead>
                    <TableHead className="w-0">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {res.data.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatDate(t.date)}</TableCell>
                      <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <Link href={`/savings/accounts/${t.account_id}`} className="hover:underline">
                          {t.account_number ?? "Account"}
                        </Link>
                      </TableCell>
                      <TableCell>{t.borrower_name ?? "—"}</TableCell>
                      <TableCell>{labelOf(TRANSACTION_TYPE_LABELS, t.type)}</TableCell>
                      <TableCell>{t.method ? labelOf(METHOD_LABELS, t.method) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {isNilAmount(t.debit) ? "" : formatCurrency(t.debit)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {isNilAmount(t.credit) ? "" : formatCurrency(t.credit)}
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
        onRequested={() => resource.refetch()}
      />
    </div>
  );
}
