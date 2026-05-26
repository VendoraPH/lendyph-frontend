"use client";

import { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { RouteGuard, PermissionGate, TablePagination } from "@/components/common";
import { AutoPayToggleDialog } from "@/components/auto-pay-toggle-dialog";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { loanService } from "@/services/loan.service";
import { loanProductService } from "@/services/loan-product.service";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Plus,
  Clock,
  XCircle,
  Banknote,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateISO } from "@/lib/format";
import type { Loan, LoanProduct } from "@/types/loan";
import { LoanTable } from "./_components/loan-table";
import { LoanFilters } from "./_components/loan-filters";
import {
  FILTER_TABS,
  ACTIVE_STATUSES,
  matchesTab,
  matchesSearch,
  matchesDateRange,
  loanProductId,
  compareLoans,
  numOrNull,
  dateOrNull,
  clampOneOf,
  type FilterTab,
  type LoanSortKey,
  type SortDir,
} from "./_components/utils";

const PER_PAGE_OPTIONS = [10, 20, 50] as const;
const SORT_KEYS: LoanSortKey[] = [
  "application_number",
  "borrower",
  "product",
  "amount",
  "term",
  "status",
  "created_at",
];

// Clickable KPI card. When `active` is true the card is visually "pressed"
// so it's obvious that it drives the filter below.
function StatCard({
  label,
  value,
  valueClassName,
  icon,
  iconBg,
  active,
  onClick,
}: {
  label: string;
  value: number;
  valueClassName?: string;
  icon: React.ReactNode;
  iconBg: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "text-left rounded-lg border bg-card transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40",
        active
          ? "border-brand-orange ring-1 ring-brand-orange/40 shadow-sm"
          : "hover:border-brand-orange/40 hover:shadow-sm",
      )}
    >
      <div className="py-4 px-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className={cn("text-2xl font-bold", valueClassName)}>{value}</p>
          </div>
          <div className={cn("rounded-full p-2.5", iconBg)}>{icon}</div>
        </div>
      </div>
    </button>
  );
}

export default function LoansPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── URL → state (derived every render, cheap) ──
  const tab = clampOneOf<FilterTab>(
    (searchParams.get("tab") as FilterTab) ?? "all",
    ["all", "active", ...FILTER_TABS.filter((t) => t.value !== "all").map((t) => t.value)] as FilterTab[],
    "all",
  );
  const q = searchParams.get("q") ?? "";
  const productId = numOrNull(searchParams.get("product_id"));
  const dateFrom = dateOrNull(searchParams.get("from"));
  const dateTo = dateOrNull(searchParams.get("to"));
  const sortKey = clampOneOf<LoanSortKey>(
    (searchParams.get("sort") as LoanSortKey) ?? "created_at",
    SORT_KEYS,
    "created_at",
  );
  const sortDir = clampOneOf<SortDir>(
    (searchParams.get("dir") as SortDir) ?? "desc",
    ["asc", "desc"],
    "desc",
  );
  const page = Math.max(1, numOrNull(searchParams.get("page")) ?? 1);
  const perPage = clampOneOf<number>(
    numOrNull(searchParams.get("per_page")) ?? 10,
    PER_PAGE_OPTIONS,
    10,
  );

  // ── Local-only state (not in URL) ──
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [searchDraft, setSearchDraft] = useState(q);
  const [autoPayTarget, setAutoPayTarget] = useState<{
    loanId: number;
    loanAccountNumber?: string | null;
    enabled: boolean;
    cbsReference?: string | null;
  } | null>(null);

  // Keep searchParams in a ref so updateParams always reads the latest URL,
  // even when called multiple times within a single render or inside a
  // debounced callback. Capturing searchParams in a closure would cause the
  // "last call wins" race that broke the Clear button and the search debounce.
  const searchParamsRef = useRef(searchParams);
  useLayoutEffect(() => {
    searchParamsRef.current = searchParams;
  });

  // ── URL-update helper. Resets page=1 unless only `page` is being updated. ──
  const updateParams = useCallback(
    (next: Partial<Record<string, string | null>>) => {
      const p = new URLSearchParams(searchParamsRef.current.toString());
      const keys = Object.keys(next);
      const resetsPage = keys.some((k) => k !== "page");
      if (resetsPage) p.delete("page");
      for (const [k, v] of Object.entries(next)) {
        if (v == null || v === "") p.delete(k);
        else p.set(k, v);
      }
      const qs = p.toString();
      router.replace(qs ? `?${qs}` : "", { scroll: false });
    },
    [router],
  );

  // ── Fetch loans + products in parallel on mount ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await loanService.list();
        if (cancelled) return;
        const data = Array.isArray(res) ? res : (res.data ?? []);
        setLoans(data);
      } catch {
        if (!cancelled) toast.error("Failed to load loans");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    (async () => {
      try {
        setProductsLoading(true);
        const res = await loanProductService.list();
        if (cancelled) return;
        setProducts(Array.isArray(res) ? res : []);
      } catch {
        // Soft-fail: filter just shows empty product list, page still works.
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Debounce searchDraft → URL ──
  useEffect(() => {
    if (searchDraft === q) return;
    const t = setTimeout(() => {
      updateParams({ q: searchDraft });
    }, 250);
    return () => clearTimeout(t);
    // `q` and `updateParams` are intentionally excluded — we only fire when
    // the local draft changes. `updateParams` is now closure-safe via the
    // searchParamsRef pattern above, so omitting it cannot cause stale URL
    // writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  // ── URL q → draft (browser back/forward, external nav) ──
  useEffect(() => {
    setSearchDraft((current) => (current === q ? current : q));
  }, [q]);

  // ── Counts from unfiltered loans (KPI cards + tab badges) ──
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: loans.length };
    for (const loan of loans) {
      counts[loan.status] = (counts[loan.status] ?? 0) + 1;
    }
    counts.active = loans.filter((l) => ACTIVE_STATUSES.includes(l.status)).length;
    return counts;
  }, [loans]);

  const summaryStats = useMemo(
    () => ({
      total: loans.length,
      forReview: loans.filter((l) => l.status === "for_review").length,
      active: statusCounts.active ?? 0,
      rejected: loans.filter((l) => l.status === "rejected").length,
    }),
    [loans, statusCounts.active],
  );

  // ── Filter → sort → slice pipeline ──
  const filtered = useMemo(() => {
    return loans.filter(
      (l) =>
        matchesTab(l, tab) &&
        (productId == null || loanProductId(l) === productId) &&
        matchesDateRange(l, dateFrom, dateTo) &&
        matchesSearch(l, q),
    );
  }, [loans, tab, productId, dateFrom, dateTo, q]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => compareLoans(a, b, sortKey, sortDir)),
    [filtered, sortKey, sortDir],
  );

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * perPage;
  const pageRows = sorted.slice(startIndex, startIndex + perPage);

  // ── Handlers ──
  function handleTabChange(next: FilterTab) {
    updateParams({ tab: next === "all" ? null : next });
  }

  function handleProductChange(id: number | null) {
    updateParams({ product_id: id == null ? null : String(id) });
  }

  function handleDateRangeChange(from: Date | null, to: Date | null) {
    updateParams({
      from: from ? formatDateISO(from) : null,
      to: to ? formatDateISO(to) : null,
    });
  }

  function handleSortChange(key: LoanSortKey) {
    const sameKey = key === sortKey;
    const nextDir: SortDir = sameKey && sortDir === "desc" ? "asc" : "desc";
    updateParams({
      sort: key === "created_at" ? null : key,
      dir: nextDir === "desc" ? null : "asc",
    });
  }

  function handlePerPageChange(next: number) {
    updateParams({ per_page: next === 10 ? null : String(next) });
  }

  function handlePageChange(next: number) {
    updateParams({ page: next === 1 ? null : String(next) });
  }

  const productOptions = useMemo(
    () => products.map((p) => ({ id: p.id, name: p.name ?? `Product #${p.id}` })),
    [products],
  );

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
          <div className="flex items-center gap-2">
            <Link href="/loans/past-due">
              <Button variant="outline">
                <AlertTriangle className="mr-2 h-4 w-4 text-red-600" />
                Past Due Loans
              </Button>
            </Link>
            <PermissionGate permission="loans:create">
              <Link href="/loans/new">
                <Button className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark">
                  <Plus className="mr-2 h-4 w-4" />
                  New Application
                </Button>
              </Link>
            </PermissionGate>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Applications"
            value={summaryStats.total}
            valueClassName=""
            icon={<FileText className="h-5 w-5 text-brand-blue" />}
            iconBg="bg-brand-blue/10"
            active={tab === "all"}
            onClick={() => handleTabChange("all")}
          />
          <StatCard
            label="Pending Approval"
            value={summaryStats.forReview}
            valueClassName="text-amber-600"
            icon={<Clock className="h-5 w-5 text-amber-600" />}
            iconBg="bg-amber-500/10"
            active={tab === "for_review"}
            onClick={() => handleTabChange("for_review")}
          />
          <StatCard
            label="Active Loans"
            value={summaryStats.active}
            valueClassName="text-green-600"
            icon={<Banknote className="h-5 w-5 text-green-600" />}
            iconBg="bg-green-500/10"
            active={tab === "active"}
            onClick={() => handleTabChange("active")}
          />
          <StatCard
            label="Rejected"
            value={summaryStats.rejected}
            valueClassName="text-red-600"
            icon={<XCircle className="h-5 w-5 text-red-600" />}
            iconBg="bg-red-500/10"
            active={tab === "rejected"}
            onClick={() => handleTabChange("rejected")}
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleTabChange(t.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
                tab === t.value
                  ? "border-brand-orange bg-brand-orange/5 text-brand-orange ring-1 ring-brand-orange"
                  : "border-border text-muted-foreground hover:border-brand-orange/40 hover:bg-muted/50",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "ml-1 rounded-full px-1.5 py-0.5 text-xs",
                  tab === t.value
                    ? "bg-brand-orange text-brand-orange-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {statusCounts[t.value] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-medium">
              Loan Applications ({total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <LoanFilters
                search={searchDraft}
                onSearchChange={setSearchDraft}
                productId={productId}
                onProductChange={handleProductChange}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateRangeChange={handleDateRangeChange}
                productOptions={productOptions}
                productsLoading={productsLoading}
              />
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="size-6 text-brand-orange" />
              </div>
            ) : (
              <>
                <LoanTable
                  loans={pageRows}
                  sort={{ key: sortKey, dir: sortDir }}
                  onSortChange={handleSortChange}
                  onRowClick={(id) => router.push(`/loans/${id}`)}
                  onAutoPayClick={(loan) =>
                    setAutoPayTarget({
                      loanId: loan.id,
                      loanAccountNumber: loan.loan_account_number,
                      enabled: loan.auto_pay_enabled ?? false,
                      cbsReference: loan.auto_pay_cbs_reference,
                    })
                  }
                />
                <TablePagination
                  page={safePage}
                  perPage={perPage}
                  total={total}
                  onPageChange={handlePageChange}
                  onPerPageChange={handlePerPageChange}
                />
              </>
            )}
          </CardContent>
        </Card>
        {autoPayTarget && (
          <AutoPayToggleDialog
            loanId={autoPayTarget.loanId}
            loanAccountNumber={autoPayTarget.loanAccountNumber}
            currentEnabled={autoPayTarget.enabled}
            currentCbsReference={autoPayTarget.cbsReference}
            open={!!autoPayTarget}
            onOpenChange={(open) => {
              if (!open) setAutoPayTarget(null);
            }}
            onSuccess={(settings) => {
              const targetId = autoPayTarget.loanId;
              setLoans((prev) =>
                prev.map((l) =>
                  l.id === targetId
                    ? {
                        ...l,
                        auto_pay_enabled: settings.auto_pay_enabled,
                        auto_pay_cbs_reference: settings.cbs_reference,
                      }
                    : l,
                ),
              );
            }}
          />
        )}
      </div>
    </RouteGuard>
  );
}
