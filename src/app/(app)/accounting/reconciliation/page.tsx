"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { RouteGuard } from "@/components/common";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccountingResource, useChartOfAccounts, usePermission } from "@/hooks";
import { accountingService } from "@/services";
import { formatCentavos } from "@/lib/accounting/money";
import { cn } from "@/lib/utils";
import type { DrainResult } from "@/lib/paginate";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { AccountingPageHeader } from "../_components/page-header";
import { DataState } from "../_components/data-state";
import { FilterBar } from "../_components/accounting-filters";
import { AccountSelect } from "../_components/account-select";
import { BranchAccessNotice } from "./_components/branch-access-notice";
import { FigureWithNote } from "./_components/figure-with-note";
import { MatchBadge, ReconciledBadge } from "./_components/match-badge";
import { NewReconciliationDialog } from "./_components/new-reconciliation-dialog";
import { ReasonButton } from "./_components/reason-button";
import { accountLabel, reconciledLabel, rowFigures } from "./_lib/reconciliation-view";
import type { ReconciliationDetail } from "./_lib/types";

const DESCRIPTION = "Prove each money account against its statement.";

function detailHref(id: number): string {
  return `/accounting/reconciliation/${id}`;
}

function ReconciliationContent() {
  const router = useRouter();
  const { postable, isTemplate, loading: chartLoading } = useChartOfAccounts();
  const [accountId, setAccountId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const moneyAccounts = useMemo(
    () => postable.filter((a) => Boolean(a.cash_kind)),
    [postable],
  );

  // Drained. The account filter below narrows what is already in hand, so a
  // short page makes "No reconciliation for this account" a lie rather than an
  // empty state. The list answers the same worksheet as the reconciliation's
  // own page, ids and counts included.
  const fetcher = useCallback(
    () => accountingService.reconciliationsListAll() as Promise<DrainResult<ReconciliationDetail>>,
    [],
  );
  const resource = useAccountingResource<DrainResult<ReconciliationDetail>>(fetcher);

  const createReason = isTemplate
    ? "The chart of accounts isn't available, so no account can be picked."
    : moneyAccounts.length === 0
      ? "No money account is set up yet."
      : null;

  const created = (reconciliation: ReconciliationDetail) => {
    setCreating(false);
    toast.success(`Reconciliation started for ${reconciliation.period}`);
    router.push(detailHref(reconciliation.id));
  };

  return (
    <div className="space-y-6">
      <AccountingPageHeader
        title="Reconciliation"
        description={DESCRIPTION}
        actions={
          <ReasonButton reason={chartLoading ? null : createReason} disabled={chartLoading} onClick={() => setCreating(true)}>
            <Plus className="mr-1 size-4" />
            New reconciliation
          </ReasonButton>
        }
      />

      {/*
        Said plainly because the point of reconciling is easy to lose: it is
        not about making a number look tidy. A difference here means either
        the ledger is missing something real or the statement is — and the
        only way to know which is to look line by line.
      */}
      <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        A difference between your books and the statement is a real
        discrepancy, not a rounding artefact. Find the missing line rather
        than adjusting the balance.
      </div>

      <FilterBar>
        <AccountSelect
          label="Account"
          accounts={moneyAccounts}
          value={accountId}
          onChange={setAccountId}
          placeholder={chartLoading ? "Loading…" : "All money accounts"}
        />
      </FilterBar>

      <DataState
        resource={resource}
        summary="Book balance against the bank, GCash or Maya statement, with each line marked matched, unmatched or a possible match."
        endpoints={[
          "GET /accounting/reconciliations",
          "POST /accounting/reconciliations",
          "POST /accounting/reconciliations/{id}/match",
        ]}
        isEmpty={(drain) => drain.rows.length === 0}
        emptyMessage="No reconciliation has been started."
      >
        {({ rows: items, truncated, total }) => {
          const shown =
            accountId === null
              ? items
              : items.filter((item) => item.account_id === accountId);

          const notice = truncated ? (
            <IncompleteListNotice
              shown={items.length}
              total={total}
              noun="reconciliations"
              consequence="A reconciliation missing here will not appear under its account either."
            />
          ) : null;

          if (shown.length === 0) {
            return (
              <div className="space-y-4">
                {notice}
                <Card>
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    No reconciliation for this account.
                  </CardContent>
                </Card>
              </div>
            );
          }

          return (
            <div className="space-y-4">
              {notice}
              {shown.map((item) => (
                <ReconciliationCard key={item.id} reconciliation={item} />
              ))}
            </div>
          );
        }}
      </DataState>

      <NewReconciliationDialog
        open={creating}
        accounts={moneyAccounts}
        onOpenChange={setCreating}
        onCreated={created}
      />
    </div>
  );
}

/** Reconciliation reads every branch's books, so the list is asked for only with access to all branches. */
function ReconciliationGate() {
  const canViewAll = usePermission().can("branches:view_all");
  if (canViewAll) return <ReconciliationContent />;
  return (
    <div className="space-y-6">
      <AccountingPageHeader title="Reconciliation" description={DESCRIPTION} />
      <BranchAccessNotice />
    </div>
  );
}

export default function ReconciliationPage() {
  return (
    <RouteGuard permission="accounting:reconcile" pageName="Reconciliation">
      <ReconciliationGate />
    </RouteGuard>
  );
}

function ReconciliationCard({
  reconciliation,
}: {
  reconciliation: ReconciliationDetail;
}) {
  const clean = reconciliation.is_reconciled;
  const href = detailHref(reconciliation.id);

  return (
    <Card className={cn("border-2", clean ? "border-emerald-500/40" : "border-amber-500/50")}>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <Link href={href} className="font-medium underline-offset-2 hover:underline">
              {reconciliation.period}
            </Link>
            <p className="text-sm text-muted-foreground">{accountLabel(reconciliation)}</p>
          </div>
          <div className="flex items-center gap-2">
            <ReconciledBadge reconciled={clean} label={reconciledLabel(reconciliation)} />
            <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Figure label="Per books" value={reconciliation.book_balance} />
          <Figure label="Per statement" value={reconciliation.statement_balance} />
          <Figure
            label="Difference"
            value={reconciliation.difference}
            className={clean ? undefined : "text-amber-600"}
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-36">Reference</TableHead>
              <TableHead className="w-36">Match</TableHead>
              <TableHead className="w-32 text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reconciliation.lines.map((line) => {
              const figures = rowFigures(line);
              return (
                <TableRow key={`${line.statement_line_id ?? "l"}-${line.journal_line_id ?? "s"}`}>
                  <TableCell className="text-sm">
                    <FigureWithNote figure={figures.date} note={figures.dateNote} />
                  </TableCell>
                  <TableCell className="text-sm">{line.description}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {line.external_reference || "—"}
                  </TableCell>
                  <TableCell>
                    <MatchBadge match={line.match} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    <FigureWithNote figure={figures.amount} note={figures.amountNote} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Figure({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("font-mono text-lg font-semibold", className)}>
        {formatCentavos(value)}
      </p>
    </div>
  );
}
