"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Formatters ──

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    amount
  );

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

// ── Types ──

type CollectionStatus = "due_today" | "upcoming" | "overdue" | "collected";

interface CollectionEntry {
  id: number;
  borrower_name: string;
  loan_account: string;
  due_date: string;
  amount_due: number;
  days_overdue?: number;
  status: CollectionStatus;
}

// ── Mock Data ──

const INITIAL_COLLECTIONS: CollectionEntry[] = [
  {
    id: 1,
    borrower_name: "Maria Santos",
    loan_account: "LA-20260007",
    due_date: "2026-03-31",
    amount_due: 5667,
    status: "due_today",
  },
  {
    id: 2,
    borrower_name: "Juan Dela Cruz",
    loan_account: "LA-20260008",
    due_date: "2026-03-31",
    amount_due: 13750,
    status: "due_today",
  },
  {
    id: 3,
    borrower_name: "Ana Reyes",
    loan_account: "LA-20260003",
    due_date: "2026-03-31",
    amount_due: 4033,
    status: "due_today",
  },
  {
    id: 4,
    borrower_name: "Roberto Tan",
    loan_account: "LA-20260009",
    due_date: "2026-04-05",
    amount_due: 16250,
    status: "upcoming",
  },
  {
    id: 5,
    borrower_name: "Rosa Mendoza",
    loan_account: "LA-20260005",
    due_date: "2026-04-07",
    amount_due: 9583,
    status: "upcoming",
  },
  {
    id: 6,
    borrower_name: "Elena Villanueva",
    loan_account: "LA-20260010",
    due_date: "2026-04-12",
    amount_due: 11333,
    status: "upcoming",
  },
  {
    id: 7,
    borrower_name: "Gloria Pascual",
    loan_account: "LA-20260011",
    due_date: "2026-02-22",
    amount_due: 13542,
    days_overdue: 37,
    status: "overdue",
  },
  {
    id: 8,
    borrower_name: "Pedro Garcia",
    loan_account: "LA-20260012",
    due_date: "2026-03-15",
    amount_due: 7250,
    days_overdue: 16,
    status: "overdue",
  },
  {
    id: 9,
    borrower_name: "Dennis Aquino",
    loan_account: "LA-20260013",
    due_date: "2026-03-24",
    amount_due: 3750,
    days_overdue: 7,
    status: "overdue",
  },
  {
    id: 10,
    borrower_name: "Lorna Bautista",
    loan_account: "LA-20260014",
    due_date: "2026-03-31",
    amount_due: 8000,
    status: "collected",
  },
  {
    id: 11,
    borrower_name: "Carlo Ramos",
    loan_account: "LA-20260015",
    due_date: "2026-03-31",
    amount_due: 6050,
    status: "collected",
  },
  {
    id: 12,
    borrower_name: "Marina Cruz",
    loan_account: "LA-20260016",
    due_date: "2026-03-31",
    amount_due: 4500,
    status: "collected",
  },
];

// ── Status Config ──

const statusConfig: Record<
  CollectionStatus,
  { label: string; className: string }
> = {
  due_today: {
    label: "Due Today",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  upcoming: {
    label: "Upcoming",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-100 text-red-700 border-red-200",
  },
  collected: {
    label: "Collected",
    className: "bg-green-100 text-green-700 border-green-200",
  },
};

type FilterTab = "all" | CollectionStatus;

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "due_today", label: "Due Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
  { value: "collected", label: "Collected" },
];

// ── Main Page ──

export default function CollectionsPage() {
  const [collections, setCollections] =
    useState<CollectionEntry[]>(INITIAL_COLLECTIONS);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [confirmEntry, setConfirmEntry] = useState<CollectionEntry | null>(
    null
  );

  // Summary stats
  const stats = useMemo(() => {
    const dueToday = collections.filter((c) => c.status === "due_today");
    const upcoming = collections.filter((c) => c.status === "upcoming");
    const overdue = collections.filter((c) => c.status === "overdue");
    const collected = collections.filter((c) => c.status === "collected");

    return {
      dueTodayCount: dueToday.length,
      dueTodayAmount: dueToday.reduce((s, c) => s + c.amount_due, 0),
      upcomingCount: upcoming.length,
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, c) => s + c.amount_due, 0),
      collectedCount: collected.length,
      collectedAmount: collected.reduce((s, c) => s + c.amount_due, 0),
    };
  }, [collections]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: collections.length };
    for (const c of collections) {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return counts;
  }, [collections]);

  // Filtered list
  const filtered = useMemo(() => {
    if (activeTab === "all") return collections;
    return collections.filter((c) => c.status === activeTab);
  }, [collections, activeTab]);

  // Mark collected
  function handleMarkCollected(entry: CollectionEntry) {
    setCollections((prev) =>
      prev.map((c) =>
        c.id === entry.id ? { ...c, status: "collected" as const } : c
      )
    );
    setConfirmEntry(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Collections</h1>
        <p className="text-muted-foreground">
          Track daily collections and overdue accounts
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Due Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Due Today</CardTitle>
            <Calendar className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {stats.dueTodayCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(stats.dueTodayAmount)}
            </p>
          </CardContent>
        </Card>

        {/* Upcoming */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {stats.upcomingCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">next 14 days</p>
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {stats.overdueCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(stats.overdueAmount)}
            </p>
          </CardContent>
        </Card>

        {/* Collected Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Collected Today
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {stats.collectedCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(stats.collectedAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
              activeTab === tab.value
                ? "border-brand-orange bg-brand-orange/5 text-brand-orange ring-1 ring-brand-orange"
                : "border-border text-muted-foreground hover:border-brand-orange/40 hover:bg-muted/50"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "ml-1 rounded-full px-1.5 py-0.5 text-xs",
                activeTab === tab.value
                  ? "bg-brand-orange text-brand-orange-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {tabCounts[tab.value] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Table — desktop */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Collection Entries ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Loan Account</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount Due</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.borrower_name}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {entry.loan_account}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(entry.due_date)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(entry.amount_due)}
                    </TableCell>
                    <TableCell>
                      {entry.status === "overdue" && entry.days_overdue ? (
                        <span className="font-medium text-red-600">
                          {entry.days_overdue}d
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusConfig[entry.status].className}
                      >
                        {statusConfig[entry.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {(entry.status === "due_today" ||
                        entry.status === "overdue") && (
                        <Button
                          size="sm"
                          className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                          onClick={() => setConfirmEntry(entry)}
                        >
                          Mark Collected
                        </Button>
                      )}
                      {entry.status === "collected" && (
                        <span className="text-sm text-green-600 font-medium flex items-center justify-end gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          Done
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No collection entries found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border bg-card p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{entry.borrower_name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {entry.loan_account}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={statusConfig[entry.status].className}
                  >
                    {statusConfig[entry.status].label}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Due: {formatDate(entry.due_date)}
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(entry.amount_due)}
                  </span>
                </div>
                {entry.status === "overdue" && entry.days_overdue && (
                  <p className="text-xs font-medium text-red-600">
                    {entry.days_overdue} days overdue
                  </p>
                )}
                {(entry.status === "due_today" ||
                  entry.status === "overdue") && (
                  <Button
                    size="sm"
                    className="w-full bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                    onClick={() => setConfirmEntry(entry)}
                  >
                    Mark Collected
                  </Button>
                )}
                {entry.status === "collected" && (
                  <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    Collected
                  </p>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">
                No collection entries found.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog
        open={!!confirmEntry}
        onOpenChange={(open) => !open && setConfirmEntry(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Collection</DialogTitle>
            <DialogDescription>
              Mark this payment as collected?
            </DialogDescription>
          </DialogHeader>

          {confirmEntry && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Borrower</span>
                <span className="font-medium">{confirmEntry.borrower_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loan Account</span>
                <span className="font-mono">{confirmEntry.loan_account}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Due</span>
                <span className="font-semibold">
                  {formatCurrency(confirmEntry.amount_due)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span>{formatDate(confirmEntry.due_date)}</span>
              </div>
            </div>
          )}

          <DialogFooter showCloseButton>
            <Button
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              onClick={() => confirmEntry && handleMarkCollected(confirmEntry)}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirm Collected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
