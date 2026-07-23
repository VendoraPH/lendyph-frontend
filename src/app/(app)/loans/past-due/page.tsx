"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notifyError } from "@/lib/notify";
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
  ArrowRight,
  ArrowUpDown,
  Loader2,
  RefreshCw,
  Search,
  Users,
  Banknote,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { reportService } from "@/services";

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

// ── Response mapping ──
//
// /api/reports/due-past-due is documented in swagger as a paginated list of
// "schedules that are due or overdue as of today" — but the response body
// shape isn't pinned down there. Map defensively against the most likely
// snake_case field names so this works whether the row represents a loan
// summary or an individual schedule period, with sensible fallbacks.

interface RawPastDueRow {
  [key: string]: unknown;
  loan?: { loan_account_number?: string; outstanding_balance?: number | string } | null;
  borrower?: {
    full_name?: string;
    name?: string;
    borrower_code?: string;
  } | null;
  branch?: { name?: string } | string | null;
}

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const str = (v: unknown, fallback = ""): string => {
  if (v === null || v === undefined) return fallback;
  return String(v);
};

const computeDaysPastDue = (raw: RawPastDueRow): number => {
  const direct = num(raw.days_past_due ?? raw.days_overdue ?? raw.daysPastDue);
  if (direct > 0) return direct;
  const dueDate = raw.due_date ?? raw.dueDate;
  if (typeof dueDate === "string") {
    const ms = Date.now() - new Date(dueDate).getTime();
    if (Number.isFinite(ms) && ms > 0) {
      return Math.floor(ms / 86_400_000);
    }
  }
  return 0;
};

const mapRow = (raw: RawPastDueRow): PastDueLoan => {
  const loanId = num(raw.loan_id ?? raw.loanId ?? raw.id);
  const loanNumber = str(
    raw.loan_account_number ??
      raw.loan_number ??
      raw.loanNumber ??
      raw.loan?.loan_account_number,
    loanId ? `#${loanId}` : "—",
  );
  const memberId = str(
    raw.borrower_code ??
      raw.member_id ??
      raw.memberId ??
      raw.borrower?.borrower_code ??
      raw.borrower_id,
    "—",
  );
  const memberName = str(
    raw.borrower_name ??
      raw.member_name ??
      raw.memberName ??
      raw.borrower?.full_name ??
      raw.borrower?.name,
    "—",
  );
  const branchValue = raw.branch_name ?? raw.branchName ?? raw.branch;
  const branch =
    typeof branchValue === "object" && branchValue !== null
      ? str((branchValue as { name?: string }).name, "—")
      : str(branchValue, "—");
  const lastPaymentRaw =
    raw.last_payment_date ??
    raw.last_payment_at ??
    raw.lastPaymentDate ??
    null;
  const lastPaymentDate =
    typeof lastPaymentRaw === "string" ? lastPaymentRaw : null;

  return {
    loanId,
    loanNumber,
    memberId,
    memberName,
    daysPastDue: computeDaysPastDue(raw),
    pastDuePrincipal: num(
      raw.past_due_principal ??
        raw.pastDuePrincipal ??
        raw.principal_due ??
        raw.principal_remaining,
    ),
    pastDueInterest: num(
      raw.past_due_interest ??
        raw.pastDueInterest ??
        raw.interest_due ??
        raw.interest_remaining,
    ),
    pastDuePenalty: num(
      raw.past_due_penalty ??
        raw.pastDuePenalty ??
        raw.penalty_amount ??
        raw.penalty,
    ),
    outstandingBalance: num(
      raw.outstanding_balance ??
        raw.outstandingBalance ??
        raw.remaining_balance ??
        raw.loan?.outstanding_balance,
    ),
    lastPaymentDate,
    branch,
  };
};

// Some Laravel reports return rows directly; others wrap them in a paginated
// envelope with `{ data: [...] }`. Handle both transparently.
const extractRows = (resp: unknown): RawPastDueRow[] => {
  if (Array.isArray(resp)) return resp as RawPastDueRow[];
  if (resp && typeof resp === "object") {
    const r = resp as { data?: unknown };
    if (Array.isArray(r.data)) return r.data as RawPastDueRow[];
    // Double-wrapped: { data: { data: [...] } } — defensive
    if (r.data && typeof r.data === "object") {
      const inner = (r.data as { data?: unknown }).data;
      if (Array.isArray(inner)) return inner as RawPastDueRow[];
    }
  }
  return [];
};

// If the backend returns one row per overdue *schedule period* instead of
// one row per loan, multiple rows can share the same loan_id. Aggregate
// into per-loan summaries so the UI shows each member's loan once.
const aggregateByLoan = (rows: PastDueLoan[]): PastDueLoan[] => {
  const map = new Map<number, PastDueLoan>();
  for (const r of rows) {
    if (!r.loanId) continue;
    const existing = map.get(r.loanId);
    if (existing) {
      existing.pastDuePrincipal += r.pastDuePrincipal;
      existing.pastDueInterest += r.pastDueInterest;
      existing.pastDuePenalty += r.pastDuePenalty;
      // Keep the largest daysPastDue (oldest unpaid period defines the loan's age)
      if (r.daysPastDue > existing.daysPastDue) {
        existing.daysPastDue = r.daysPastDue;
      }
      // Outstanding should be the loan's running balance — same across periods
      // but take the max defensively in case some rows omit it.
      if (r.outstandingBalance > existing.outstandingBalance) {
        existing.outstandingBalance = r.outstandingBalance;
      }
      // Latest last-payment date wins
      if (
        r.lastPaymentDate &&
        (!existing.lastPaymentDate ||
          new Date(r.lastPaymentDate) > new Date(existing.lastPaymentDate))
      ) {
        existing.lastPaymentDate = r.lastPaymentDate;
      }
    } else {
      map.set(r.loanId, { ...r });
    }
  }
  return Array.from(map.values());
};

// ── Page ──

export default function PastDueLoansPage() {
  const [loans, setLoans] = useState<PastDueLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<AgingBucket>("all");
  const [sortKey, setSortKey] = useState<SortKey>("daysPastDue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await reportService.duePastDue({ per_page: 9999 });
      const mapped = extractRows(res).map(mapRow);
      setLoans(aggregateByLoan(mapped));
    } catch (err) {
      console.error("Failed to load past-due loans:", err);
      notifyError(err, "We couldn't load past due loans. Please try again.");
      setLoans([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return loans.filter((l) => {
      if (!inBucket(l.daysPastDue, bucket)) return false;
      if (!q) return true;
      return (
        l.memberName.toLowerCase().includes(q) ||
        l.memberId.toLowerCase().includes(q) ||
        l.loanNumber.toLowerCase().includes(q)
      );
    });
  }, [loans, search, bucket]);

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
              Members with overdue loan payments as of today.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw
              className={cn(
                "mr-2 h-3.5 w-3.5",
                refreshing && "animate-spin",
              )}
            />
            Refresh
          </Button>
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
                    {loading ? "—" : totals.memberCount}
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
                    {loading ? "—" : totals.loanCount}
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
                    {loading ? "—" : formatCurrency(totals.pastDueSum)}
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
                    {loading ? "—" : formatCurrency(totals.outstandingSum)}
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
                  disabled={loading}
                />
              </div>
              <Select
                value={bucket}
                onValueChange={(v) => setBucket(v as AgingBucket)}
                disabled={loading}
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
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Loading past due loans…</p>
              </div>
            ) : sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 opacity-40" />
                <p className="text-sm">
                  {loans.length === 0
                    ? "No past due loans — all members are current."
                    : "No past due loans match your filter."}
                </p>
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
                            severityClass(l.daysPastDue),
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
                          nativeButton={false}
                          render={<Link href={`/loans/${l.loanId}`} />}
                          aria-label="Open loan"
                        >
                          Open
                          <ArrowRight className="ml-1 h-3 w-3" />
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
