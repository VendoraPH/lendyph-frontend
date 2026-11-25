"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { FilePenLine, Search, Undo2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ALL_BRANCHES, branchIdParam } from "@/components/common/branch-filter";
import { AlignedBranchFilter } from "../../_components/aligned-branch-filter";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
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
import { FIT_CLASSES } from "@/lib/page-fill";
import { cn } from "@/lib/utils";
import { savingsService } from "@/services";
import type { SavingsTransaction, SavingsTransactionType } from "@/types";
import { ActionButton } from "../../_components/action-button";
import { OptionSelect } from "../../_components/option-select";
import { RecordReferenceDialog, type RecordReferenceTarget } from "../../_components/record-reference-dialog";
import { ReverseTransactionDialog } from "../../_components/reverse-transaction-dialog";
import { registerViewOf, typedReference, type RegisterView } from "../../_lib/payout-reference";
import { MissingReferenceList } from "./missing-reference-list";
import {
  METHOD_LABELS,
  TRANSACTION_TYPE_LABELS,
  actorName,
  isNilAmount,
  labelOf,
  reversalBlocker,
} from "../../_lib/savings-rules";
import { useBranchFilter, useBranchFollowingPage } from "@/hooks/use-working-branch";

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  ...(Object.keys(TRANSACTION_TYPE_LABELS) as SavingsTransactionType[]).map((t) => ({
    value: t,
    label: TRANSACTION_TYPE_LABELS[t],
  })),
];

function recordTarget(t: SavingsTransaction): RecordReferenceTarget {
  return {
    source: "transaction",
    id: t.id,
    number: t.reference,
    description: `${labelOf(TRANSACTION_TYPE_LABELS, t.type)} by ${labelOf(METHOD_LABELS, t.method)} of ${formatCurrency(t.debit)} on ${formatDate(t.date)}`,
  };
}

/**
 * Savings Transactions: every account's transactions (`GET /savings/transactions`),
 * paged on the server, and the payouts still missing their reference (finish run
 * round 6), opened from the Savings dashboard with `?view=missing-reference`.
 */
export function RegisterScreen() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<RegisterView>(() => registerViewOf(searchParams.get("view")));

  return (
    <PageFill>
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Savings Transactions</h1>
        <p className="text-sm text-muted-foreground">
          {view === "all"
            ? "Every posted savings line across accounts. A reversal is requested here and posts once another user approves it."
            : "Withdrawals, closing payouts and time deposit payouts sent by bank transfer, GCash or Maya that still have no reference. Record each one once the money is sent."}
        </p>
      </div>
      <Tabs value={view} onValueChange={(v) => setView(registerViewOf(String(v)))} className="shrink-0">
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All transactions</TabsTrigger>
          <TabsTrigger value="missing-reference">Payouts missing a reference</TabsTrigger>
        </TabsList>
      </Tabs>
      {view === "all" ? <RegisterList /> : <MissingReferenceList />}
    </PageFill>
  );
}

/** The register itself. */
function RegisterList() {
  const [type, setType] = useState("all");
  const [branch, setBranch] = useBranchFilter();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useBranchFollowingPage();
  const [perPage, setPerPage] = useState(20);
  const [reversing, setReversing] = useState<SavingsTransaction | null>(null);
  const [recording, setRecording] = useState<RecordReferenceTarget | null>(null);

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
    <>
      <div className="flex shrink-0 flex-wrap items-end gap-2">
        <OptionSelect value={type} onChange={firstPage(setType)} options={TYPE_OPTIONS} className="w-48" />
        <AlignedBranchFilter value={branch} onChange={firstPage(setBranch)} className="w-48" />
        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          From
          <Input type="date" value={dateFrom} onChange={(e) => firstPage(setDateFrom)(e.target.value)} className="w-36" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          To
          <Input type="date" value={dateTo} onChange={(e) => firstPage(setDateTo)(e.target.value)} className="w-36" />
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
        emptyIllustration={
          search || type !== "all" || branch !== ALL_BRANCHES || dateFrom || dateTo ? "noResults" : "emptySavings"
        }
      >
        {(res) => (
          <div className={FIT_CLASSES.section}>
            <div className={cn("rounded-lg border bg-card", FIT_CLASSES.section)}>
              <ScrollBox>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Number</TableHead>
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
                        <TableCell className="font-mono text-xs">{typedReference(t.external_reference)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          <Link href={`/savings/accounts/${t.account_id}`} className="hover:underline">
                            {t.account_number ?? "Account"}
                          </Link>
                        </TableCell>
                        <TableCell className="min-w-32 whitespace-normal">{t.borrower_name ?? "—"}</TableCell>
                        <TableCell>{labelOf(TRANSACTION_TYPE_LABELS, t.type)}</TableCell>
                        <TableCell>{t.method ? labelOf(METHOD_LABELS, t.method) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {isNilAmount(t.debit) ? "" : formatCurrency(t.debit)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {isNilAmount(t.credit) ? "" : formatCurrency(t.credit)}
                        </TableCell>
                        <TableCell className="min-w-24 whitespace-normal">{actorName(t.created_by)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {t.can_record_reference ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setRecording(recordTarget(t))}
                                aria-label={`Record reference for ${t.reference}`}
                                title="Record reference"
                              >
                                <FilePenLine className="h-4 w-4" />
                              </Button>
                            ) : null}
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
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollBox>
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
      <RecordReferenceDialog
        target={recording}
        onOpenChange={(open) => !open && setRecording(null)}
        onRecorded={() => resource.refetch()}
      />
    </>
  );
}
