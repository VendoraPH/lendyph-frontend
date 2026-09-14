"use client";

import { useCallback, useState } from "react";
import { ArrowRight } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccountingResource } from "@/hooks";
import { accountingService } from "@/services";
import { agingBucketLabel } from "@/lib/accounting/aging";
import { formatCentavos } from "@/lib/accounting/money";
import { formatDate, todayISO } from "@/lib/format";
import type { Aging } from "@/types";
import { AccountingPageHeader } from "../_components/page-header";
import { DataState } from "../_components/data-state";
import {
  ALL_BRANCHES,
  BranchFilter,
  DateFilter,
  FilterBar,
  branchParam,
} from "../_components/accounting-filters";

/**
 * What Lendy posts for each lending event, in plain language.
 *
 * This is documentation, not data — it mirrors the rules in
 * `@/lib/accounting/posting-rules`, which is what actually runs. It earns its
 * place on this screen because the whole promise of the module is that the
 * books keep themselves, and the fastest way to trust that is to be able to
 * read what it does.
 */
const POSTING_RULES = [
  {
    event: "Loan released",
    debit: "Loans Receivable",
    credit: "Cash / Bank / GCash / Maya",
    note: "The money leaves, and a receivable of the same size takes its place. Releasing a loan is not an expense.",
  },
  {
    event: "Payment collected",
    debit: "Cash / Bank / GCash / Maya",
    credit: "Loans Receivable, Interest Income, Penalty Income",
    note: "Split exactly as the loan module allocated it. Accounting never re-derives the principal and interest split.",
  },
  {
    event: "Interest earned",
    debit: "Interest Receivable",
    credit: "Interest Income",
    note: "Income is recognised as it is earned, not only when it is collected.",
  },
  {
    event: "Penalty charged",
    debit: "Penalty Receivable",
    credit: "Penalty Income",
    note: "Charged when it accrues; collected against the receivable later.",
  },
  {
    event: "Processing fee collected",
    debit: "Cash / Bank",
    credit: "Processing Fee Income",
    note: "Deducted at release or collected separately, depending on the product.",
  },
  {
    event: "Provision for credit losses",
    debit: "Credit Loss Expense",
    credit: "Allowance for Credit Losses",
    note: "The allowance is a contra-asset: it reduces net loans receivable without touching the gross balance a borrower still owes.",
  },
];

export default function LoanAccountingPage() {
  const [asOf, setAsOf] = useState(todayISO());
  const [branch, setBranch] = useState(ALL_BRANCHES);

  const fetcher = useCallback(
    () => accountingService.receivableAging(asOf, branchParam(branch)),
    [asOf, branch],
  );
  const resource = useAccountingResource<Aging>(fetcher);

  return (
    <RouteGuard permission="accounting:view" pageName="Loan Accounting">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Loan Accounting"
          description="How the loan portfolio looks from the ledger's side."
        />

        <FilterBar>
          <DateFilter label="As of" value={asOf} onChange={setAsOf} />
          <BranchFilter value={branch} onChange={setBranch} />
        </FilterBar>

        <DataState
          resource={resource}
          summary="Outstanding receivables split by how far past due they are — the input every provisioning policy needs."
          endpoints={["GET /accounting/loans/aging"]}
          isEmpty={(aging) => aging.rows.length === 0}
          emptyMessage="No outstanding receivable on this date."
        >
          {(aging) => <AgingTable aging={aging} />}
        </DataState>

        <Card>
          <CardContent className="pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              What Lendy posts for you
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You record the lending transaction. These entries are written
              automatically, in the same step, so the books cannot fall behind
              the loan records.
            </p>

            <div className="mt-4 space-y-3">
              {POSTING_RULES.map((rule) => (
                <div key={rule.event} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{rule.event}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-700">
                      Dr {rule.debit}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="rounded bg-blue-500/10 px-2 py-0.5 text-blue-700">
                      Cr {rule.credit}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{rule.note}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </RouteGuard>
  );
}

function AgingTable({ aging }: { aging: Aging }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-1 pt-6">
            <p className="text-sm text-muted-foreground">Total outstanding</p>
            <p className="font-mono text-2xl font-semibold">
              {formatCentavos(aging.total)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-6">
            <p className="text-sm text-muted-foreground">Past due</p>
            <p className="font-mono text-2xl font-semibold text-amber-600">
              {formatCentavos(aging.past_due_total)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="mb-4 text-sm text-muted-foreground">
            As of {formatDate(aging.as_of)}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bucket</TableHead>
                <TableHead className="w-24 text-right">Accounts</TableHead>
                <TableHead className="w-40 text-right">Amount</TableHead>
                <TableHead className="w-48">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aging.rows.map((row) => (
                <TableRow key={row.bucket}>
                  <TableCell className="text-sm">
                    {agingBucketLabel(row.bucket)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {row.count}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCentavos(row.amount)}
                  </TableCell>
                  <TableCell>
                    <Progress
                      value={
                        aging.total > 0 ? (row.amount / aging.total) * 100 : 0
                      }
                      className="h-2"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {aging.rows.reduce((n, r) => n + r.count, 0)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatCentavos(aging.total)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
