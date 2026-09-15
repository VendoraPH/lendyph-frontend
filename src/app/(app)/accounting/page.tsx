"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  BookOpen,
  CheckCircle2,
  FileText,
  Landmark,
  ListTree,
  Receipt,
  Scale,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { RouteGuard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAccountingResource } from "@/hooks";
import { accountingService } from "@/services";
import { formatCentavos } from "@/lib/accounting/money";
import { formatDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AccountingDashboard } from "@/types";
import { AccountingPageHeader } from "./_components/page-header";
import { DataState } from "./_components/data-state";
import {
  ALL_BRANCHES,
  BranchFilter,
  DateFilter,
  FilterBar,
  branchParam,
} from "./_components/accounting-filters";

/** Where a loan officer actually goes from here. */
const SHORTCUTS = [
  { href: "/accounting/journals", label: "Journal Entries", icon: ListTree },
  { href: "/accounting/expenses", label: "Record an expense", icon: Receipt },
  { href: "/accounting/cash-bank", label: "Cash & Bank", icon: Wallet },
  { href: "/accounting/statements", label: "Financial Statements", icon: FileText },
  { href: "/accounting/chart-of-accounts", label: "Chart of Accounts", icon: BookOpen },
  { href: "/accounting/trial-balance", label: "Trial Balance", icon: Scale },
];

export default function AccountingDashboardPage() {
  const [asOf, setAsOf] = useState(todayISO());
  const [branch, setBranch] = useState(ALL_BRANCHES);

  const fetcher = useCallback(
    () => accountingService.dashboard(asOf, branchParam(branch)),
    [asOf, branch],
  );
  const resource = useAccountingResource<AccountingDashboard>(fetcher);

  return (
    <RouteGuard permission="accounting:view" pageName="Accounting">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Accounting"
          description="Where the lending operation stands, in accounting terms."
        />

        <FilterBar>
          <DateFilter label="As of" value={asOf} onChange={setAsOf} />
          <BranchFilter value={branch} onChange={setBranch} />
        </FilterBar>

        <DataState
          resource={resource}
          summary="A one-screen position: money on hand, what is owed to and by the business, and the month's result."
          endpoints={["GET /accounting/dashboard"]}
        >
          {(data) => <DashboardBody data={data} />}
        </DataState>

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
    </RouteGuard>
  );
}

function Figure({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Wallet;
  tone?: "positive" | "negative";
}) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-sm">{label}</span>
        </div>
        <p
          className={cn(
            "font-mono text-2xl font-semibold",
            tone === "positive" && "text-emerald-600",
            tone === "negative" && "text-red-600",
          )}
        >
          {formatCentavos(value)}
        </p>
      </CardContent>
    </Card>
  );
}

function DashboardBody({ data }: { data: AccountingDashboard }) {
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
        <CardContent className="flex items-center gap-3 py-4">
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
              As of {formatDate(data.as_of)}
              {data.open_period ? ` · open period ${data.open_period}` : ""}
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

      <div>
        <p className="mb-3 text-sm font-medium text-muted-foreground">
          Money and receivables
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Figure label="Cash on hand" value={data.cash_on_hand} icon={Banknote} />
          <Figure label="Cash in bank" value={data.cash_in_bank} icon={Landmark} />
          <Figure label="E-wallets" value={data.e_wallets} icon={Smartphone} />
          <Figure
            label="Loans receivable, net"
            value={data.loans_receivable_net}
            icon={Wallet}
          />
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-muted-foreground">Position</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Figure label="Total assets" value={data.total_assets} icon={Scale} />
          <Figure
            label="Total liabilities"
            value={data.total_liabilities}
            icon={Receipt}
          />
          <Figure label="Total equity" value={data.total_equity} icon={Landmark} />
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-muted-foreground">
          This month
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Figure label="Income" value={data.income_mtd} icon={TrendingUp} />
          <Figure label="Expenses" value={data.expenses_mtd} icon={TrendingDown} />
          <Figure
            label="Net income"
            value={data.net_income_mtd}
            icon={Scale}
            tone={data.net_income_mtd < 0 ? "negative" : "positive"}
          />
        </div>
      </div>
    </div>
  );
}
