"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks";
import {
  FilePlus,
  CreditCard,
  ClipboardList,
  Users,
  FileText,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Wallet,
  CalendarClock,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate() {
  return new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const phpFormat = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const ATTENTION_LOANS = [
  { id: 2, app_number: "LA-20260002", borrower: "Roberto Garcia", amount: 100000, status: "for_review", date: "2026-03-28" },
  { id: 4, app_number: "LA-20260004", borrower: "Eduardo Mendoza", amount: 50000, status: "for_review", date: "2026-03-29" },
  { id: 3, app_number: "LA-20260003", borrower: "Maria L. Reyes", amount: 30000, status: "approved", date: "2026-03-27" },
  { id: 7, app_number: "LA-20260007", borrower: "Ana Santos", amount: 15000, status: "approved", date: "2026-03-30" },
  { id: 9, app_number: "LA-20260009", borrower: "Danilo Villanueva", amount: 80000, status: "defaulted", date: "2026-03-15" },
  { id: 11, app_number: "LA-20260011", borrower: "Carmen Torres", amount: 5000, status: "defaulted", date: "2026-03-01" },
] as const;

const RECENT_ACTIVITY = [
  { type: "released", title: "Loan Released", detail: "LA-20260005 — ₱50,000 to Eduardo Mendoza", time: "Today, 9:42 AM", href: "/loans/5" },
  { type: "payment", title: "Payment Received", detail: "₱3,933 from Rosario Santos — GCash", time: "Today, 9:15 AM", href: "/payments/history" },
  { type: "new", title: "New Borrower", detail: "Ana Santos registered as active borrower", time: "Today, 8:30 AM", href: "/borrowers" },
  { type: "approved", title: "Loan Approved", detail: "LA-20260007 — ₱15,000 for Ana Santos", time: "Yesterday, 4:45 PM", href: "/loans/7" },
  { type: "overdue", title: "Overdue Notice", detail: "Danilo Villanueva — 30 days past due", time: "Yesterday, 2:00 PM", href: "/collections" },
  { type: "payment", title: "Payment Received", detail: "₱9,417 from Roberto Garcia — Cash", time: "Yesterday, 11:20 AM", href: "/payments/history" },
  { type: "released", title: "Loan Released", detail: "LA-20260008 — ₱20,000 to Maria Reyes", time: "Mar 29, 3:30 PM", href: "/loans/8" },
  { type: "completed", title: "Loan Completed", detail: "LA-20260001 — Rosario Santos fully paid", time: "Mar 29, 10:00 AM", href: "/loans/1" },
] as const;

// ---------------------------------------------------------------------------
// Color maps
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  for_review: { bg: "bg-amber-100", text: "text-amber-700", label: "For Review" },
  approved: { bg: "bg-blue-100", text: "text-blue-700", label: "Approved" },
  defaulted: { bg: "bg-red-100", text: "text-red-700", label: "Defaulted" },
};

const ACTION_STYLES: Record<string, { className: string; label: string }> = {
  for_review: { className: "bg-amber-100 text-amber-700 hover:bg-amber-200", label: "Review" },
  approved: { className: "bg-blue-100 text-blue-700 hover:bg-blue-200", label: "Release" },
  defaulted: { className: "bg-red-100 text-red-700 hover:bg-red-200", label: "Follow Up" },
};

const ACTIVITY_DOT_COLORS: Record<string, string> = {
  released: "bg-brand-orange",
  payment: "bg-green-500",
  new: "bg-brand-blue",
  approved: "bg-brand-orange",
  overdue: "bg-red-500",
  completed: "bg-green-500",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { user } = useAuth();
  const greeting = useMemo(() => getGreeting(), []);
  const formattedDate = useMemo(() => getFormattedDate(), []);

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Section 1: Welcome Banner                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="rounded-xl bg-gradient-to-br from-brand-blue/10 via-brand-orange/5 to-transparent border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {greeting}, {user?.full_name ?? "Admin"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {formattedDate} · {user?.branch?.name ?? "Main Branch"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="rounded-lg bg-amber-100 text-amber-700 px-3 py-1.5 font-medium">
              23 payments due today
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Section 2: Quick Actions                                          */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {[
          {
            href: "/loans/new",
            icon: FilePlus,
            iconBg: "bg-brand-orange/10",
            iconColor: "text-brand-orange",
            title: "New Loan Application",
            description: "Create a new loan application",
          },
          {
            href: "/payments",
            icon: CreditCard,
            iconBg: "bg-brand-blue/10",
            iconColor: "text-brand-blue",
            title: "Record Payment",
            description: "Post a borrower payment",
          },
          {
            href: "/collections",
            icon: ClipboardList,
            iconBg: "bg-green-500/10",
            iconColor: "text-green-600",
            title: "View Collections",
            description: "Check today's collections",
          },
        ].map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="hover:border-brand-orange hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 py-4">
                <div className={`rounded-full p-2.5 ${action.iconBg}`}>
                  <action.icon className={`h-5 w-5 ${action.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{action.title}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Section 3: KPI Cards                                              */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Link href="/borrowers">
          <Card className="border-l-4 border-l-brand-blue group hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Borrowers</p>
                  <p className="text-2xl font-bold">1,248</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="text-green-600">+12%</span> from last month
                  </p>
                </div>
                <div className="rounded-full bg-brand-blue/10 p-2.5">
                  <Users className="h-5 w-5 text-brand-blue" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/loans">
          <Card className="border-l-4 border-l-brand-orange group hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Active Loans</p>
                  <p className="text-2xl font-bold">843</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="text-green-600">+5%</span> from last month
                  </p>
                </div>
                <div className="rounded-full bg-brand-orange/10 p-2.5">
                  <FileText className="h-5 w-5 text-brand-orange" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/payments/history">
          <Card className="border-l-4 border-l-green-500 group hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Collected</p>
                  <p className="text-2xl font-bold">₱2.4M</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="text-green-600">+18%</span> from last month
                  </p>
                </div>
                <div className="rounded-full bg-green-500/10 p-2.5">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/collections">
          <Card className="border-l-4 border-l-red-500 group hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Overdue Accounts</p>
                  <p className="text-2xl font-bold text-destructive">47</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="text-destructive">+3</span> since yesterday
                  </p>
                </div>
                <div className="rounded-full bg-red-500/10 p-2.5">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Section 4: Portfolio Stats Row                                     */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Portfolio</p>
                <p className="text-2xl font-bold">₱15.2M</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Outstanding balance across all loans
                </p>
              </div>
              <div className="rounded-full bg-brand-orange/10 p-2.5">
                <Wallet className="h-5 w-5 text-brand-orange" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground">Collection Rate</p>
                <p className="text-2xl font-bold text-green-600">94.5%</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  On-time payment percentage
                </p>
              </div>
              <div className="rounded-full bg-green-500/10 p-2.5">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <Progress value={94.5} className="mt-3">
              {/* Progress component renders its own track + indicator */}
            </Progress>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Due Today</p>
                <p className="text-2xl font-bold">23</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {phpFormat.format(145000)} total amount
                </p>
              </div>
              <div className="rounded-full bg-brand-blue/10 p-2.5">
                <CalendarClock className="h-5 w-5 text-brand-blue" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Section 5: Two-column bottom layout                               */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Left: Loans Needing Attention */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Loans Needing Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan #</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ATTENTION_LOANS.map((loan) => {
                    const statusStyle = STATUS_COLORS[loan.status];
                    const actionStyle = ACTION_STYLES[loan.status];
                    return (
                      <TableRow key={loan.id}>
                        <TableCell className="font-medium">{loan.app_number}</TableCell>
                        <TableCell>{loan.borrower}</TableCell>
                        <TableCell className="text-right">
                          {phpFormat.format(loan.amount)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                          >
                            {statusStyle.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/loans/${loan.id}`}>
                            <Button
                              size="xs"
                              className={actionStyle.className}
                            >
                              {actionStyle.label}
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right: Recent Activity */}
        <div>
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-0">
                {RECENT_ACTIVITY.map((item, i) => (
                  <Link
                    key={i}
                    href={item.href}
                    className="flex items-start gap-3 border-b border-border py-3 last:border-0 hover:bg-muted/50 -mx-4 px-4 transition-colors"
                  >
                    <div className="mt-1.5 shrink-0">
                      <div
                        className={`h-2 w-2 rounded-full ${ACTIVITY_DOT_COLORS[item.type] ?? "bg-muted-foreground"}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {item.detail}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground shrink-0 mt-0.5">
                      {item.time}
                    </p>
                  </Link>
                ))}
              </div>
            </CardContent>
            <div className="border-t px-4 py-3">
              <Link
                href="/audit-trail"
                className="flex items-center justify-center gap-1 text-sm font-medium text-brand-orange hover:underline"
              >
                View All Activity
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
