"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  for_review: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-blue-100 text-blue-700 border-blue-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  released: "bg-cyan-100 text-cyan-700 border-cyan-200",
  ongoing: "bg-green-100 text-green-700 border-green-200",
  completed: "bg-gray-100 text-gray-600 border-gray-200",
  defaulted: "bg-red-100 text-red-700 border-red-200",
  restructured: "bg-orange-100 text-orange-700 border-orange-200",
  closed: "bg-gray-200 text-gray-500 border-gray-300",
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

// ── Mock Data ──

const MOCK_LOANS: Loan[] = [
  {
    id: 1,
    application_number: "LA-20260001",
    borrower_id: 1,
    borrower_name: "Maria Santos",
    loan_product_name: "Salary Loan",
    principal_amount: 50000,
    interest_rate: 3,
    interest_type: "fixed",
    term_months: 12,
    payment_frequency: "monthly",
    total_payable: 68000,
    outstanding_balance: 0,
    status: "draft",
    purpose: "Home renovation",
    created_at: "2026-03-28T09:15:00Z",
    updated_at: "2026-03-28T09:15:00Z",
  },
  {
    id: 2,
    application_number: "LA-20260002",
    borrower_id: 2,
    borrower_name: "Juan Dela Cruz",
    loan_product_name: "Business Loan",
    principal_amount: 150000,
    interest_rate: 2.5,
    interest_type: "diminishing",
    term_months: 24,
    payment_frequency: "monthly",
    total_payable: 195000,
    outstanding_balance: 0,
    status: "draft",
    purpose: "Sari-sari store expansion",
    created_at: "2026-03-27T14:30:00Z",
    updated_at: "2026-03-27T14:30:00Z",
  },
  {
    id: 3,
    application_number: "LA-20260003",
    borrower_id: 3,
    borrower_name: "Ana Reyes",
    loan_product_name: "Emergency Loan",
    principal_amount: 20000,
    interest_rate: 3.5,
    interest_type: "fixed",
    term_months: 6,
    payment_frequency: "bi_weekly",
    total_payable: 24200,
    outstanding_balance: 0,
    status: "for_review",
    purpose: "Medical expenses",
    created_at: "2026-03-25T10:00:00Z",
    updated_at: "2026-03-26T08:00:00Z",
  },
  {
    id: 4,
    application_number: "LA-20260004",
    borrower_id: 4,
    borrower_name: "Pedro Garcia",
    loan_product_name: "Salary Loan",
    principal_amount: 80000,
    interest_rate: 3,
    interest_type: "fixed",
    term_months: 18,
    payment_frequency: "monthly",
    total_payable: 123200,
    outstanding_balance: 0,
    status: "for_review",
    purpose: "Tuition fee",
    created_at: "2026-03-24T16:45:00Z",
    updated_at: "2026-03-25T09:30:00Z",
  },
  {
    id: 5,
    application_number: "LA-20260005",
    borrower_id: 5,
    borrower_name: "Rosa Mendoza",
    loan_product_name: "Business Loan",
    principal_amount: 200000,
    interest_rate: 2.5,
    interest_type: "diminishing",
    term_months: 36,
    payment_frequency: "monthly",
    total_payable: 290000,
    outstanding_balance: 0,
    status: "approved",
    purpose: "Bakery equipment purchase",
    approved_by: "Augustin Maputol",
    approved_at: "2026-03-23T11:00:00Z",
    approval_remarks: "Good credit history, approved for full amount",
    created_at: "2026-03-20T08:30:00Z",
    updated_at: "2026-03-23T11:00:00Z",
  },
  {
    id: 6,
    application_number: "LA-20260006",
    borrower_id: 6,
    borrower_name: "Carlo Ramos",
    loan_product_name: "Emergency Loan",
    principal_amount: 30000,
    interest_rate: 3.5,
    interest_type: "fixed",
    term_months: 6,
    payment_frequency: "weekly",
    total_payable: 36300,
    outstanding_balance: 0,
    status: "rejected",
    purpose: "Debt consolidation",
    rejected_by: "Augustin Maputol",
    rejected_at: "2026-03-22T14:00:00Z",
    rejection_remarks: "Existing loan still outstanding, exceeds debt-to-income ratio",
    created_at: "2026-03-19T13:00:00Z",
    updated_at: "2026-03-22T14:00:00Z",
  },
  {
    id: 7,
    application_number: "LA-20260007",
    borrower_id: 7,
    borrower_name: "Elena Villanueva",
    loan_product_name: "Salary Loan",
    principal_amount: 100000,
    interest_rate: 3,
    interest_type: "fixed",
    term_months: 12,
    payment_frequency: "monthly",
    total_payable: 136000,
    outstanding_balance: 102000,
    status: "released",
    purpose: "Home improvement",
    approved_by: "Augustin Maputol",
    approved_at: "2026-03-10T09:00:00Z",
    released_by: "Maria Santos",
    released_at: "2026-03-12T10:00:00Z",
    release_date: "2026-03-12",
    maturity_date: "2027-03-12",
    next_due_date: "2026-04-12",
    created_at: "2026-03-08T11:00:00Z",
    updated_at: "2026-03-12T10:00:00Z",
  },
  {
    id: 8,
    application_number: "LA-20260008",
    borrower_id: 8,
    borrower_name: "Roberto Tan",
    loan_product_name: "Business Loan",
    principal_amount: 300000,
    interest_rate: 2.5,
    interest_type: "diminishing",
    term_months: 24,
    payment_frequency: "monthly",
    total_payable: 390000,
    outstanding_balance: 325000,
    status: "ongoing",
    purpose: "Trucking business capital",
    approved_by: "Augustin Maputol",
    approved_at: "2026-02-15T09:00:00Z",
    released_by: "Maria Santos",
    released_at: "2026-02-18T14:00:00Z",
    release_date: "2026-02-18",
    maturity_date: "2028-02-18",
    next_due_date: "2026-04-18",
    created_at: "2026-02-10T08:00:00Z",
    updated_at: "2026-03-18T14:00:00Z",
  },
  {
    id: 9,
    application_number: "LA-20260009",
    borrower_id: 9,
    borrower_name: "Lorna Bautista",
    loan_product_name: "Salary Loan",
    principal_amount: 40000,
    interest_rate: 3,
    interest_type: "fixed",
    term_months: 6,
    payment_frequency: "monthly",
    total_payable: 47200,
    outstanding_balance: 0,
    status: "completed",
    purpose: "Wedding expenses",
    approved_by: "Augustin Maputol",
    approved_at: "2025-09-05T10:00:00Z",
    released_by: "Maria Santos",
    released_at: "2025-09-08T09:00:00Z",
    release_date: "2025-09-08",
    maturity_date: "2026-03-08",
    created_at: "2025-09-01T07:30:00Z",
    updated_at: "2026-03-08T15:00:00Z",
  },
  {
    id: 10,
    application_number: "LA-20260010",
    borrower_id: 10,
    borrower_name: "Dennis Aquino",
    loan_product_name: "Emergency Loan",
    principal_amount: 15000,
    interest_rate: 3.5,
    interest_type: "fixed",
    term_months: 3,
    payment_frequency: "weekly",
    total_payable: 16575,
    outstanding_balance: 0,
    status: "completed",
    purpose: "Appliance repair",
    approved_by: "Augustin Maputol",
    approved_at: "2025-12-10T11:00:00Z",
    released_by: "Maria Santos",
    released_at: "2025-12-12T09:00:00Z",
    release_date: "2025-12-12",
    maturity_date: "2026-03-12",
    created_at: "2025-12-08T14:00:00Z",
    updated_at: "2026-03-12T16:00:00Z",
  },
  {
    id: 11,
    application_number: "LA-20260011",
    borrower_id: 11,
    borrower_name: "Gloria Pascual",
    loan_product_name: "Business Loan",
    principal_amount: 250000,
    interest_rate: 2.5,
    interest_type: "diminishing",
    term_months: 24,
    payment_frequency: "monthly",
    total_payable: 325000,
    outstanding_balance: 310000,
    status: "defaulted",
    purpose: "Restaurant startup",
    approved_by: "Augustin Maputol",
    approved_at: "2025-08-20T09:00:00Z",
    released_by: "Maria Santos",
    released_at: "2025-08-22T10:00:00Z",
    release_date: "2025-08-22",
    maturity_date: "2027-08-22",
    next_due_date: "2026-01-22",
    created_at: "2025-08-15T08:00:00Z",
    updated_at: "2026-03-15T09:00:00Z",
  },
];

// ── Main Page ──

export default function LoansPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  // Compute counts per status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: MOCK_LOANS.length };
    for (const loan of MOCK_LOANS) {
      counts[loan.status] = (counts[loan.status] ?? 0) + 1;
    }
    return counts;
  }, []);

  // Summary stats
  const summaryStats = useMemo(() => {
    const forReview = MOCK_LOANS.filter((l) => l.status === "for_review").length;
    const active = MOCK_LOANS.filter(
      (l) => l.status === "released" || l.status === "ongoing"
    ).length;
    const rejected = MOCK_LOANS.filter((l) => l.status === "rejected").length;
    return { total: MOCK_LOANS.length, forReview, active, rejected };
  }, []);

  // Filtered loans
  const filteredLoans = useMemo(() => {
    let loans = MOCK_LOANS;

    if (activeTab !== "all") {
      loans = loans.filter((l) => l.status === activeTab);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      loans = loans.filter(
        (l) =>
          (l.application_number ?? "").toLowerCase().includes(q) ||
          (l.borrower_name ?? "").toLowerCase().includes(q) ||
          (l.loan_product_name ?? "").toLowerCase().includes(q) ||
          (l.purpose ?? "").toLowerCase().includes(q)
      );
    }

    return loans;
  }, [activeTab, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loan Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage loan applications and track approval workflow
          </p>
        </div>
        <Link href="/loans/new">
          <Button className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark">
            <Plus className="mr-2 h-4 w-4" />
            New Application
          </Button>
        </Link>
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application #</TableHead>
                  <TableHead>Borrower</TableHead>
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
                      {loan.borrower_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {loan.loan_product_name}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(loan.principal_amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {loan.term_months}mo /{" "}
                      {PAYMENT_FREQUENCY_LABELS[loan.payment_frequency] ??
                        loan.payment_frequency}
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
        </CardContent>
      </Card>
    </div>
  );
}
