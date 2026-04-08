"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { RouteGuard, PermissionGate } from "@/components/common";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { loanService } from "@/services/loan.service";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  FileText,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LOAN_STATUS_LABELS, PAYMENT_FREQUENCY_LABELS } from "@/constants";
import type { Loan, LoanStatus } from "@/types/loan";

// ── Currency Formatter ──

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

// ── Status Colors ──

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
  for_review: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800",
  approved: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-800",
  rejected: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  released: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-800",
  ongoing: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800",
  completed: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
  defaulted: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  restructured: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-800",
  closed: "bg-gray-200 text-gray-500 border-gray-300 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
};

// ── Filter Tabs ──

type FilterTab = "all" | LoanStatus;

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "for_review", label: "For Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "released", label: "Released" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
];

// ── Main Page ──

export default function LoansPage() {
  const router = useRouter();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const fetchLoans = useCallback(async () => {
    try {
      setLoading(true);
      const res = await loanService.list();
      const data = Array.isArray(res) ? res : res.data ?? [];
      setLoans(data);
    } catch {
      toast.error("Failed to load loans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  // Compute counts per status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: loans.length };
    for (const loan of loans) {
      counts[loan.status] = (counts[loan.status] ?? 0) + 1;
    }
    return counts;
  }, [loans]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const forReview = loans.filter((l) => l.status === "for_review").length;
    const active = loans.filter(
      (l) => l.status === "released" || l.status === "ongoing"
    ).length;
    const rejected = loans.filter((l) => l.status === "rejected").length;
    return { total: loans.length, forReview, active, rejected };
  }, [loans]);

  // Filtered loans
  const filteredLoans = useMemo(() => {
    let filtered = loans;

    if (activeTab !== "all") {
      filtered = filtered.filter((l) => l.status === activeTab);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          (l.application_number ?? "").toLowerCase().includes(q) ||
          (l.borrower_name ?? "").toLowerCase().includes(q) ||
          (l.loan_product_name ?? "").toLowerCase().includes(q) ||
          (l.purpose ?? "").toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [loans, activeTab, search]);

  return (
    <RouteGuard permission="loans:view" pageName="Loans">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loan Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage loan applications and track approval workflow
          </p>
        </div>
        <PermissionGate permission="loans:create">
          <Link href="/loans/new">
            <Button className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark">
              <Plus className="mr-2 h-4 w-4" />
              New Application
            </Button>
          </Link>
        </PermissionGate>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Total Applications
                </p>
                <p className="text-2xl font-bold">{summaryStats.total}</p>
              </div>
              <div className="rounded-full bg-brand-blue/10 p-2.5">
                <FileText className="h-5 w-5 text-brand-blue" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Pending Approval
                </p>
                <p className="text-2xl font-bold text-amber-600">
                  {summaryStats.forReview}
                </p>
              </div>
              <div className="rounded-full bg-amber-500/10 p-2.5">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Active Loans
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {summaryStats.active}
                </p>
              </div>
              <div className="rounded-full bg-green-500/10 p-2.5">
                <Banknote className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Rejected
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {summaryStats.rejected}
                </p>
              </div>
              <div className="rounded-full bg-red-500/10 p-2.5">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Filter Tabs */}
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
              {statusCounts[tab.value] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-medium">
            Loan Applications ({filteredLoans.length})
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search loans..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="size-6 text-brand-orange" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application #</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLoans.map((loan) => (
                    <TableRow
                      key={loan.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/loans/${loan.id}`)}
                    >
                      <TableCell className="font-mono text-sm">
                        {loan.application_number}
                      </TableCell>
                      <TableCell className="font-medium">
                        {loan.borrower?.full_name ?? loan.borrower?.name ?? loan.borrower_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {loan.loan_product?.name ?? loan.loan_product_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(loan.principal_amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {loan.term ?? loan.term_months ?? 0}mo /{" "}
                        {(PAYMENT_FREQUENCY_LABELS[(loan.frequency ?? loan.payment_frequency ?? "") as keyof typeof PAYMENT_FREQUENCY_LABELS] ??
                          loan.frequency ?? loan.payment_frequency) || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusColors[loan.status]}
                        >
                          {LOAN_STATUS_LABELS[loan.status] ?? loan.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(loan.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredLoans.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No loan applications found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </RouteGuard>
  );
}
