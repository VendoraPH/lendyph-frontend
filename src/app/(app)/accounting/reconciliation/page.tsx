"use client";

import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, CircleDashed, HelpCircle } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccountingResource, useChartOfAccounts } from "@/hooks";
import { accountingService } from "@/services";
import { formatCentavos } from "@/lib/accounting/money";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Reconciliation, ReconciliationMatch } from "@/types";
import { AccountingPageHeader } from "../_components/page-header";
import { DataState } from "../_components/data-state";
import { FilterBar } from "../_components/accounting-filters";
import { AccountSelect } from "../_components/account-select";

const MATCH_META: Record<
  ReconciliationMatch,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  matched: {
    label: "Matched",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  },
  possible: {
    label: "Possible match",
    icon: HelpCircle,
    className: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  },
  unmatched: {
    label: "Unmatched",
    icon: CircleDashed,
    className: "bg-slate-500/10 text-slate-700 border-slate-500/30",
  },
};

export default function ReconciliationPage() {
  const { postable, loading: chartLoading } = useChartOfAccounts();
  const [accountId, setAccountId] = useState<number | null>(null);

  const moneyAccounts = useMemo(
    () => postable.filter((a) => Boolean(a.cash_kind)),
    [postable],
  );

  const fetcher = useCallback(
    () => accountingService.listReconciliations(),
    [],
  );
  const resource = useAccountingResource<Reconciliation[]>(fetcher);

  return (
    <RouteGuard permission="accounting:reconcile" pageName="Reconciliation">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Reconciliation"
          description="Prove each money account against its statement."
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
          isEmpty={(items) => items.length === 0}
          emptyMessage="No reconciliation has been started."
        >
          {(items) => {
            const shown =
              accountId === null
                ? items
                : items.filter((item) => item.account_id === accountId);

            if (shown.length === 0) {
              return (
                <Card>
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    No reconciliation for this account.
                  </CardContent>
                </Card>
              );
            }

            return (
              <div className="space-y-4">
                {shown.map((item) => (
                  <ReconciliationCard
                    key={`${item.account_id}-${item.period}`}
                    reconciliation={item}
                  />
                ))}
              </div>
            );
          }}
        </DataState>
      </div>
    </RouteGuard>
  );
}

function ReconciliationCard({
  reconciliation,
}: {
  reconciliation: Reconciliation;
}) {
  const clean = reconciliation.difference === 0;

  return (
    <Card className={cn("border-2", clean ? "border-emerald-500/40" : "border-amber-500/50")}>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-medium">{reconciliation.period}</p>
          <Badge
            variant="outline"
            className={
              clean
                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-700 border-amber-500/30"
            }
          >
            {clean ? "Reconciled" : "Difference"}
          </Badge>
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
            {reconciliation.lines.map((line, i) => {
              const meta = MATCH_META[line.match];
              const Icon = meta.icon;
              return (
                <TableRow key={`${line.journal_id ?? "ext"}-${i}`}>
                  <TableCell className="text-sm">{formatDate(line.date)}</TableCell>
                  <TableCell className="text-sm">{line.description}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {line.external_reference || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={meta.className}>
                      <Icon className="mr-1 h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCentavos(line.amount)}
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
