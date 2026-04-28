"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { RouteGuard } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  Search,
  Users,
  Banknote,
  Wallet,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

// ── Types ──

interface PastDueLoan {
  loanId: number;
  loanNumber: string;
  memberId: string;
  memberName: string;
  daysPastDue: number;
  pastDuePrincipal: number;
  pastDueInterest: number;
  pastDuePenalty: number;
  outstandingBalance: number;
  lastPaymentDate: string | null;
  branch: string;
}

// ── Dummy Data — replace with API once /api/reports/due-past-due is wired ──

const DUMMY_PAST_DUE: PastDueLoan[] = [
  {
    loanId: 1001,
    loanNumber: "LN-2026-0142",
    memberId: "M-00482",
    memberName: "Maria Clara Santos",
    daysPastDue: 5,
    pastDuePrincipal: 4200,
    pastDueInterest: 350,
    pastDuePenalty: 80,
    outstandingBalance: 38400,
    lastPaymentDate: "2026-04-12",
    branch: "Main",
  },
  {
    loanId: 1002,
    loanNumber: "LN-2026-0118",
    memberId: "M-00133",
    memberName: "Juan Dela Cruz",
    daysPastDue: 12,
    pastDuePrincipal: 6500,
    pastDueInterest: 540,
    pastDuePenalty: 195,
    outstandingBalance: 72200,
    lastPaymentDate: "2026-04-05",
    branch: "Main",
  },
  {
    loanId: 1003,
    loanNumber: "LN-2025-0987",
    memberId: "M-00729",
    memberName: "Ana Reyes-Villanueva",
    daysPastDue: 28,
    pastDuePrincipal: 8200,
    pastDueInterest: 720,
    pastDuePenalty: 410,
    outstandingBalance: 110500,
    lastPaymentDate: "2026-03-20",
    branch: "Cebu",
  },
  {
    loanId: 1004,
    loanNumber: "LN-2026-0033",
    memberId: "M-00211",
    memberName: "Roberto Garcia",
    daysPastDue: 35,
    pastDuePrincipal: 12500,
    pastDueInterest: 1100,
    pastDuePenalty: 875,
    outstandingBalance: 145000,
    lastPaymentDate: "2026-03-12",
    branch: "Davao",
  },
  {
    loanId: 1005,
    loanNumber: "LN-2025-0741",
    memberId: "M-00059",
    memberName: "Lourdes Mendoza",
    daysPastDue: 47,
    pastDuePrincipal: 5800,
    pastDueInterest: 510,
    pastDuePenalty: 545,
    outstandingBalance: 64200,
    lastPaymentDate: "2026-03-01",
    branch: "Main",
  },
  {
    loanId: 1006,
    loanNumber: "LN-2025-0612",
    memberId: "M-00388",
    memberName: "Andres Bonifacio",
    daysPastDue: 58,
    pastDuePrincipal: 9700,
    pastDueInterest: 880,
    pastDuePenalty: 1125,
    outstandingBalance: 132500,
    lastPaymentDate: "2026-02-18",
    branch: "Cebu",
  },
  {
    loanId: 1007,
    loanNumber: "LN-2025-0509",
    memberId: "M-00012",
    memberName: "Imelda Domingo",
    daysPastDue: 67,
    pastDuePrincipal: 3400,
    pastDueInterest: 290,
    pastDuePenalty: 455,
    outstandingBalance: 28900,
    lastPaymentDate: "2026-02-09",
    branch: "Main",
  },
  {
    loanId: 1008,
    loanNumber: "LN-2025-0444",
    memberId: "M-00674",
    memberName: "Carlos Aquino",
    daysPastDue: 79,
    pastDuePrincipal: 14200,
    pastDueInterest: 1320,
    pastDuePenalty: 1880,
    outstandingBalance: 198000,
    lastPaymentDate: "2026-01-28",
    branch: "Davao",
  },
  {
    loanId: 1009,
    loanNumber: "LN-2025-0301",
    memberId: "M-00540",
    memberName: "Pilar Magsaysay",
    daysPastDue: 88,
    pastDuePrincipal: 7100,
    pastDueInterest: 660,
    pastDuePenalty: 1050,
    outstandingBalance: 81500,
    lastPaymentDate: "2026-01-19",
    branch: "Cebu",
  },
  {
    loanId: 1010,
    loanNumber: "LN-2025-0228",
    memberId: "M-00097",
    memberName: "Felipe Ramos",
    daysPastDue: 102,
    pastDuePrincipal: 11800,
    pastDueInterest: 1080,
    pastDuePenalty: 2120,
    outstandingBalance: 156000,
    lastPaymentDate: "2026-01-05",
    branch: "Main",
  },
  {
    loanId: 1011,
    loanNumber: "LN-2024-1187",
    memberId: "M-00316",
    memberName: "Teresita Bautista",
    daysPastDue: 124,
    pastDuePrincipal: 6300,
    pastDueInterest: 590,
    pastDuePenalty: 1450,
    outstandingBalance: 71400,
    lastPaymentDate: "2025-12-14",
    branch: "Davao",
  },
  {
    loanId: 1012,
    loanNumber: "LN-2024-0982",
    memberId: "M-00805",
    memberName: "Mateo Hernandez",
    daysPastDue: 156,
    pastDuePrincipal: 18500,
    pastDueInterest: 1640,
    pastDuePenalty: 4280,
    outstandingBalance: 245000,
    lastPaymentDate: "2025-11-12",
    branch: "Cebu",
  },
];

// ── Helpers ──

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const totalPastDue = (l: PastDueLoan) =>
  l.pastDuePrincipal + l.pastDueInterest + l.pastDuePenalty;

type AgingBucket = "all" | "1-30" | "31-60" | "61-90" | "90+";

const inBucket = (days: number, bucket: AgingBucket): boolean => {
  if (bucket === "all") return true;
  if (bucket === "1-30") return days >= 1 && days <= 30;
  if (bucket === "31-60") return days >= 31 && days <= 60;
  if (bucket === "61-90") return days >= 61 && days <= 90;
  return days > 90;
};

const severityClass = (days: number): string => {
  if (days <= 30)
    return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800";
  if (days <= 60)
    return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-800";
  if (days <= 90)
    return "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800";
  return "bg-red-200 text-red-800 border-red-300 dark:bg-red-500/25 dark:text-red-300 dark:border-red-700";
};

type SortKey = "memberName" | "daysPastDue" | "pastDue" | "outstanding";
type SortDir = "asc" | "desc";

// ── Page ──

export default function PastDueLoansPage() {
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<AgingBucket>("all");
  const [sortKey, setSortKey] = useState<SortKey>("daysPastDue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return DUMMY_PAST_DUE.filter((l) => {
      if (!inBucket(l.daysPastDue, bucket)) return false;
      if (!q) return true;
      return (
        l.memberName.toLowerCase().includes(q) ||
        l.memberId.toLowerCase().includes(q) ||
        l.loanNumber.toLowerCase().includes(q)
      );
    });
  }, [search, bucket]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "memberName":
          cmp = a.memberName.localeCompare(b.memberName);
          break;
        case "daysPastDue":
          cmp = a.daysPastDue - b.daysPastDue;
          break;
        case "pastDue":
          cmp = totalPastDue(a) - totalPastDue(b);
          break;
        case "outstanding":
          cmp = a.outstandingBalance - b.outstandingBalance;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totals = useMemo(() => {
    const memberIds = new Set<string>();
    let pastDueSum = 0;
    let outstandingSum = 0;
    for (const l of sorted) {
      memberIds.add(l.memberId);
      pastDueSum += totalPastDue(l);
      outstandingSum += l.outstandingBalance;
    }
    return {
      memberCount: memberIds.size,
      loanCount: sorted.length,
      pastDueSum,
      outstandingSum,
    };
  }, [sorted]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <RouteGuard permission="loans:view" pageName="Past Due Loans">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/loans"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Loans
            </Link>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              Past Due Loans
            </h1>
            <p className="text-sm text-muted-foreground">
              Members with overdue loan payments — sample data shown until
              the API is wired.
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-500/10 p-2">
                  <Users className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Members Past Due
                  </p>
                  <p className="text-xl font-bold tabular-nums">
                    {totals.memberCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-500/10 p-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Past Due Loans
                  </p>
                  <p className="text-xl font-bold tabular-nums">
                    {totals.loanCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-500/10 p-2">
                  <Banknote className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Total Past Due
                  </p>
                  <p className="text-xl font-bold tabular-nums text-red-600">
                    {formatCurrency(totals.pastDueSum)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-brand-orange/10 p-2">
                  <Wallet className="h-5 w-5 text-brand-orange" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Outstanding Balance
                  </p>
                  <p className="text-xl font-bold tabular-nums">
                    {formatCurrency(totals.outstandingSum)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search member name, member ID, or loan number…"
                  className="pl-8"
                />
              </div>
              <Select
                value={bucket}
                onValueChange={(v) => setBucket(v as AgingBucket)}
              >
                <SelectTrigger className="sm:w-52">
                  <SelectValue placeholder="Aging bucket" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ages</SelectItem>
                  <SelectItem value="1-30">1–30 days</SelectItem>
                  <SelectItem value="31-60">31–60 days</SelectItem>
                  <SelectItem value="61-90">61–90 days</SelectItem>
                  <SelectItem value="90+">90+ days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 opacity-40" />
                <p className="text-sm">No past due loans match your filter.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("memberName")}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        Member
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>Loan #</TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("daysPastDue")}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        Days Past Due
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort("pastDue")}
                        className="ml-auto flex items-center gap-1 hover:text-foreground"
                      >
                        Past Due Amount
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort("outstanding")}
                        className="ml-auto flex items-center gap-1 hover:text-foreground"
                      >
                        Outstanding
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>Last Payment</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((l) => (
                    <TableRow key={l.loanId}>
                      <TableCell>
                        <div className="font-medium">{l.memberName}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {l.memberId}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {l.loanNumber}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "border tabular-nums",
                            severityClass(l.daysPastDue)
                          )}
                        >
                          {l.daysPastDue} {l.daysPastDue === 1 ? "day" : "days"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-red-600">
                        {formatCurrency(totalPastDue(l))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(l.outstandingBalance)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(l.lastPaymentDate)}
                      </TableCell>
                      <TableCell className="text-sm">{l.branch}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() =>
                            toast.info(
                              "This is sample data — the loan link will work once the past-due API is wired."
                            )
                          }
                        >
                          <Info className="mr-1 h-3 w-3" />
                          Demo
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </RouteGuard>
  );
}
