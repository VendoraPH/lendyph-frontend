"use client";

import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  FileBarChart,
  History,
  Percent,
  PiggyBank,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useApiResource, usePermission } from "@/hooks";
import { RouteGuard } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { savingsTransactionService } from "@/services/savings-transaction.service";
import type { Permission } from "@/types";
import type { SavingsDashboard } from "@/types/savings";

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function DashboardCards({ d }: { d: SavingsDashboard }) {
  const a = d.accounts;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Kpi label="Total deposits held" value={formatCurrency(d.total_deposits)} />
      <Kpi
        label="Active accounts"
        value={String(a.active)}
        hint={`${a.total} total · ${a.dormant} dormant · ${a.frozen} frozen · ${a.closed} closed`}
      />
      <Kpi label="Pending approvals" value={String(d.pending_approvals)} hint="Reversals and interest batches" />
      <Kpi
        label="Today's deposits"
        value={formatCurrency(d.today.deposits)}
        hint={`${d.today.deposit_count} transaction${d.today.deposit_count === 1 ? "" : "s"}`}
      />
      <Kpi
        label="Today's withdrawals"
        value={formatCurrency(d.today.withdrawals)}
        hint={`${d.today.withdrawal_count} transaction${d.today.withdrawal_count === 1 ? "" : "s"}`}
      />
      <Kpi label="Interest posted this year" value={formatCurrency(d.interest_posted_ytd)} />
    </div>
  );
}

interface QuickLink {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Any one of these lets the viewer in. */
  permission: Permission[];
  /** Also needed on top, e.g. the reports page's own `reports:view`. */
  requires?: Permission;
}

const QUICK_LINKS: QuickLink[] = [
  { title: "Accounts", href: "/savings/accounts", icon: PiggyBank, permission: ["savings:view"] },
  { title: "Open account", href: "/savings/accounts/new", icon: UserPlus, permission: ["savings:create"] },
  { title: "Deposit", href: "/savings/deposits", icon: ArrowDownToLine, permission: ["savings:deposit"] },
  { title: "Withdraw", href: "/savings/withdrawals", icon: ArrowUpFromLine, permission: ["savings:withdraw"] },
  { title: "Transfer", href: "/savings/transfers", icon: ArrowLeftRight, permission: ["savings:transfer"] },
  { title: "Transaction history", href: "/savings/transactions", icon: History, permission: ["savings:view"] },
  { title: "Interest", href: "/savings/interest", icon: Percent, permission: ["savings:post", "savings:approve"] },
  { title: "Reports", href: "/reports#savings", icon: FileBarChart, permission: ["savings:export"], requires: "reports:view" },
];

function SavingsDashboardContent() {
  const { can, canAny } = usePermission();
  const resource = useApiResource(savingsTransactionService.dashboard);
  const links = QUICK_LINKS.filter((l) => canAny(l.permission) && (!l.requires || can(l.requires)));

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title="Savings & Deposits" description="Deposits held, today's activity and what awaits approval." />
      <DataState
        resource={resource}
        summary="Totals across savings accounts: deposits held, account counts by status, today's activity, pending approvals and interest posted this year."
        endpoints={["GET /savings/dashboard"]}
      >
        {(d) => <DashboardCards d={d} />}
      </DataState>
      <nav aria-label="Savings shortcuts" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {links.map(({ title, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-lg border p-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Icon className="h-5 w-5 text-brand-orange" aria-hidden />
            {title}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default function SavingsDashboardPage() {
  return (
    <RouteGuard permission="savings:view" pageName="Savings & Deposits">
      <SavingsDashboardContent />
    </RouteGuard>
  );
}
