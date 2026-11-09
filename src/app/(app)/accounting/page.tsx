"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BookOpen,
  CheckCircle2,
  FileText,
  Landmark,
  ListTree,
  ReceiptText,
  Scale,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { RouteGuard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccountingResource } from "@/hooks";
import { accountingService } from "@/services";
import { formatDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AccountingDashboard, RecentJournal } from "@/types";
import { AccountingPageHeader } from "./_components/page-header";
import { DataState } from "./_components/data-state";
import {
  ALL_BRANCHES,
  BranchFilter,
  DateFilter,
  FilterBar,
  branchParam,
} from "./_components/accounting-filters";
import { FigureCard, FigureSection } from "./_components/dashboard/figure-card";
import { CashAccountsTable } from "./_components/dashboard/cash-accounts-table";
import { ReceivablesSection } from "./_components/dashboard/receivables-section";
import { TrendCharts } from "./_components/dashboard/trend-charts";
import { journalSourceLabel } from "./_lib/display-labels";
import { centavosOrDash } from "./_lib/dashboard-figures";
import {
  currentPeriodText,
  dashboardFromError,
  defaultDashboardFrom,
  periodRangeLabel,
} from "./_lib/dashboard-period";

/** Where a loan officer actually goes from here. */
const SHORTCUTS = [
  { href: "/accounting/journals", label: "Journal Entries", icon: ListTree },
  { href: "/accounting/expenses", label: "Record an expense", icon: ReceiptText },
  { href: "/accounting/cash-bank", label: "Cash & Bank", icon: Wallet },
  { href: "/accounting/statements", label: "Financial Statements", icon: FileText },
  { href: "/accounting/chart-of-accounts", label: "Chart of Accounts", icon: BookOpen },
  { href: "/accounting/trial-balance", label: "Trial Balance", icon: Scale },
];

function AccountingDashboardContent() {
  const [asOf, setAsOf] = useState(todayISO());
  // Follows As of's month until someone picks a From of their own.
  const [fromPicked, setFromPicked] = useState<string | null>(null);
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const from = fromPicked ?? defaultDashboardFrom(asOf);
  const datesError = dashboardFromError(from, asOf);

  const fetcher = useCallback(
    () => accountingService.dashboard(asOf, branchParam(branch), from),
    [asOf, branch, from],
  );
  const resource = useAccountingResource<AccountingDashboard>(fetcher, datesError === null);

  return (
    <div className="space-y-6">
      <AccountingPageHeader
        title="Accounting"
        description="Where the lending operation stands, in accounting terms."
      />

      <FilterBar>
        <DateFilter label="As of" value={asOf} onChange={setAsOf} />
        <DateFilter label="From" value={from} onChange={setFromPicked} />
        <BranchFilter value={branch} onChange={setBranch} />
      </FilterBar>

      {datesError ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground" role="alert">
            {datesError}
          </CardContent>
        </Card>
      ) : (
        <DataState
          resource={resource}
          summary="A one-screen position: money on hand, what is owed to and by the business, and the period's result."
          endpoints={["GET /accounting/dashboard"]}
        >
          {(data) => <DashboardBody data={data} />}
        </DataState>
      )}

      <div>
        <p className="mb-3 text-sm font-medium text-muted-foreground">Go to</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SHORTCUTS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg border bg-card p-4 text-sm transition-colors hover:bg-accent"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AccountingDashboardPage() {
  return (
    <RouteGuard permission="accounting:view" pageName="Accounting">
      <AccountingDashboardContent />
    </RouteGuard>
  );
}

function DashboardBody({ data }: { data: AccountingDashboard }) {
  const periodLabel = periodRangeLabel(data.period);
  return (
    <div className="space-y-6">
      {/*
        The balance check comes first and cannot be scrolled past. Every other
        figure on this page is read off the same ledger, so if debits and
        credits disagree none of them can be trusted, and that has to be the
        first thing anyone sees rather than a footnote under the totals.
      */}
      <Card
        className={cn(
          "border-2",
          data.is_balanced ? "border-emerald-500/40" : "border-red-500/60",
        )}
      >
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          {data.is_balanced ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-600" />
          )}
          <div className="flex-1">
            <p className="font-medium">
              {data.is_balanced
                ? "The books balance"
                : "The books do not balance"}
            </p>
            <p className="text-sm text-muted-foreground">
              As of {formatDate(data.as_of)} · {currentPeriodText(data.current_period)}
            </p>
          </div>
          {data.unposted_journals > 0 && (
            <Link href="/accounting/journals">
              <Badge variant="outline" className="cursor-pointer">
                {data.unposted_journals} unposted
              </Badge>
            </Link>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <FigureSection title="Money" className="sm:grid-cols-3">
          <FigureCard label="Cash on hand" value={data.cash_on_hand} icon={Banknote} />
          <FigureCard label="Cash in bank" value={data.cash_in_bank} icon={Landmark} />
          <FigureCard label="E-wallets" value={data.e_wallets} icon={Smartphone} />
        </FigureSection>
        <CashAccountsTable accounts={data.cash_accounts} />
      </div>

      <ReceivablesSection data={data} />

      <FigureSection title="Position" className="sm:grid-cols-3">
        <FigureCard label="Total assets" value={data.total_assets} icon={Scale} />
        <FigureCard label="Total liabilities" value={data.total_liabilities} icon={ReceiptText} />
        <FigureCard label="Total equity" value={data.total_equity} icon={Landmark} />
      </FigureSection>

      <FigureSection title="Period" description={periodLabel || undefined} className="sm:grid-cols-3">
        <FigureCard label="Income" value={data.period?.income} icon={TrendingUp} />
        <FigureCard label="Expenses" value={data.period?.expenses} icon={TrendingDown} />
        <FigureCard label="Net income" value={data.period?.net_income} icon={Scale} signed />
      </FigureSection>

      <FigureSection title="This month" className="sm:grid-cols-3">
        <FigureCard label="Income" value={data.income_mtd} icon={TrendingUp} />
        <FigureCard label="Expenses" value={data.expenses_mtd} icon={TrendingDown} />
        <FigureCard label="Net income" value={data.net_income_mtd} icon={Scale} signed />
      </FigureSection>

      <TrendCharts months={data.months} />

      <RecentJournals journals={data.recent_journals} />
    </div>
  );
}

/** The latest posted or reversed journals on or before As of, newest first, as sent. */
function RecentJournals({ journals }: { journals: readonly RecentJournal[] | undefined }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Recent journals</CardTitle>
        <Link
          href="/accounting/journals"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View all
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </CardHeader>
      <CardContent>
        {!journals || journals.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No posted journals on or before this date.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead className="w-32">Journal</TableHead>
                  <TableHead className="w-32">Source</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-32">Branch</TableHead>
                  <TableHead className="w-36 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journals.map((journal) => (
                  <TableRow key={journal.id}>
                    <TableCell className="text-sm">{formatDate(journal.date)}</TableCell>
                    <TableCell className="font-mono text-xs">{journal.journal_no}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {journalSourceLabel(journal.source)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{journal.description}</TableCell>
                    <TableCell className="text-sm">{journal.branch_name ?? "No branch"}</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {centavosOrDash(journal.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
