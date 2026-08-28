"use client";

import { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { RouteGuard, PermissionGate, TablePagination } from "@/components/common";
import { AutoPayToggleDialog } from "@/components/auto-pay-toggle-dialog";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
  VIRTUAL_TAB_VALUES,
  numOrNull,
  dateOrNull,
  isoDateOrNull,
  clampOneOf,
  tabFromParam,
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

/**
 * Global loan counts by status, read straight from the list response's
 * `meta.stats`. Deliberately an open record rather than a fixed shape: the API
 * reports every status it knows about — including legacy ones such as `ongoing`
 * and `restructured` that have no tab of their own — and each consumer here
 * only reads the keys it needs.
 *
 * These counts ignore the request's own `status`/`search`/product/date filters,
 * which is exactly why the KPI cards and tab badges can be driven from the same
 * request that fetches one page of rows.
 */
type LoanStats = Record<string, number>;

/**
 * Keys in `meta.stats` that are NOT statuses of their own, and so must never be
 * added into a total alongside the statuses they overlap.
 *
 * Derived from `VIRTUAL_TAB_VALUES` rather than typed out, so a virtual filter
 * cannot be added to the tab strip without also being excluded here. That
 * mattered immediately: `past_due` is a live `meta.stats` key now, it counts
 * `released`, `ongoing` AND `defaulted` loans that are already counted under
 * their own keys, and summing the record blind would have inflated "Total
 * Applications" by every overdue loan in the book.
 *
 *  - `active` = the sum of `Loan::ACTIVE_STATUSES` (released + ongoing).
 *  - `past_due` = `Loan::scopePastDue()`, which cuts ACROSS statuses instead of
 *    partitioning alongside them.
 *
 * `all` is here for the case where the API ever sends a total of its own; today
 * it does not, and `allCountFromStats` falls back to summing the real statuses.
 */
const AGGREGATE_STAT_KEYS = new Set<string>(["all", ...VIRTUAL_TAB_VALUES]);

function allCountFromStats(stats: LoanStats): number {
  if (typeof stats.all === "number") return stats.all;
  let sum = 0;
  for (const [key, value] of Object.entries(stats)) {
    if (!AGGREGATE_STAT_KEYS.has(key)) sum += value;
  }
  return sum;
}

function activeCountFromStats(stats: LoanStats): number {
  // Prefer the server's aggregate. The fallback re-adds the same four statuses
  // the "active" tab filters on, so the card still agrees with the table when
  // talking to an API build that predates the aggregate.
  if (typeof stats.active === "number") return stats.active;
  return ACTIVE_STATUSES.reduce((sum, status) => sum + (stats[status] ?? 0), 0);
}

// Clickable KPI card. When `active` is true the card is visually "pressed"
// so it's obvious that it drives the filter below.
//
// `value` is null while no counts are known (first load, or a load that
// failed before any response). It renders as an em dash rather than 0 —
// a zero here reads as "this coop has no loans", which is a statement of
// fact we are in no position to make.
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
  value: number | null;
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
            <p className={cn("text-2xl font-bold", valueClassName)}>
              {value ?? "—"}
            </p>
          </div>
          <div className={cn("rounded-full p-2.5", iconBg)}>{icon}</div>
        </div>
      </div>
    </button>
  );
}

export default function LoansPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ── URL → state (derived every render, cheap) ──
  // Everything the request depends on is read back out of the URL, so a deep
  // link, a browser Back, and a click on a filter all take the same path.
  // Aliases legacy values and falls back to "all" for anything unrecognised —
  // see tabFromParam for the `?tab=` contract.
  const tab = tabFromParam(searchParams.get("tab"));
  const q = searchParams.get("q") ?? "";
  // `loan_product_id` is validated as an integer server-side, and a hand-typed
  // `?product_id=2.5` would come back a 422 rather than a filtered list.
  const productIdRaw = numOrNull(searchParams.get("product_id"));
  const productId = productIdRaw == null ? null : Math.trunc(productIdRaw);
  // Kept as validated `YYYY-MM-DD` strings, not Dates: these feed both the
  // request and a dependency array, and a fresh Date object every render would
  // re-trigger the fetch effect forever.
  const dateFromParam = isoDateOrNull(searchParams.get("from"));
  const dateToParam = isoDateOrNull(searchParams.get("to"));
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
  // Floored, not just clamped: `?page=2.5` is a number, and the paginator wants
  // an integer.
  const page = Math.max(1, Math.floor(numOrNull(searchParams.get("page")) ?? 1));
  const perPage = clampOneOf<number>(
    numOrNull(searchParams.get("per_page")) ?? 10,
    PER_PAGE_OPTIONS,
    10,
  );

  const dateFrom = useMemo(() => dateOrNull(dateFromParam), [dateFromParam]);
  const dateTo = useMemo(() => dateOrNull(dateToParam), [dateToParam]);

  // Two tab values are virtual — `active` and `past_due` (VIRTUAL_TAB_VALUES).
  // Both go to the API verbatim, because both are the API's OWN shorthand and
  // both are resolved there from the same definition their `meta.stats` entry
  // is counted through, so the rows and the badge above them cannot disagree:
  //
  //   - `status=active` expands to Loan::ACTIVE_STATUSES server-side. Spelling
  //     those statuses out here would work today and would be a second copy of
  //     the definition — the copy that goes stale the day the set changes.
  //   - `status=past_due` resolves to Loan::scopePastDue(). It CANNOT be
  //     spelled out here at any price: it is derived from the amortization
  //     schedule (an unpaid installment past its due date and past the loan's
  //     `grace_period_days`), so there is no set of statuses that expresses it
  //     and no way for this client to compute it from a loan row.
  //
  // Every other tab value IS its status, so it goes as-is: the Current tab
  // sends `status=ongoing` and its badge reads `stats.ongoing`. Nothing reads
  // `stats.current` — that one is not a status any row can hold and is absent
  // from `meta.stats` on purpose.
  const statusParam = tab === "all" ? null : tab;
  const search = q.trim();

  // ── Local-only state (not in URL) ──
  const [loans, setLoans] = useState<Loan[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<LoanStats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  // Page 1 is the default, so it stays out of the URL — keeps shared links tidy
  // and keeps a single canonical URL per view.
  const goToPage = useCallback(
    (next: number) => {
      updateParams({ page: next === 1 ? null : String(next) });
    },
    [updateParams],
  );

  // Guards against out-of-order responses: fast typing or rapid page clicks can
  // land an older request last and repaint the wrong rows.
  const requestIdRef = useRef(0);

  const fetchLoans = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    // When we clamp we immediately refetch, so `loading` must stay true through
    // the hand-off — otherwise `finally` clears it and React paints one frame of
    // the previous page's rows under the new totals.
    let clamping = false;
    try {
      setLoading(true);
      setError(null);
      const res = await loanService.list({
        page,
        per_page: perPage,
        sort: sortKey,
        dir: sortDir,
        ...(statusParam && { status: statusParam }),
        ...(search && { search }),
        ...(productId != null && { loan_product_id: productId }),
        ...(dateFromParam && { date_from: dateFromParam }),
        ...(dateToParam && { date_to: dateToParam }),
      });
      if (requestId !== requestIdRef.current) return;
      const rows = res.data ?? [];

      // Totals and counts are authoritative on every response, so apply them
      // before the clamp check — otherwise the page we are about to re-request
      // leaves the cards and the paginator showing the previous numbers.
      setTotal(res.meta?.total ?? rows.length);
      // Replaced only when the response actually carries counts. Defaulting to
      // `{}` would blank the KPI cards back to em dashes on any response that
      // omitted `stats`, which is worse than keeping the last figures the API
      // did confirm.
      if (res.meta?.stats) setStats(res.meta.stats);

      // A deep link (or a loan changing status under an active filter) can put
      // `page` past `last_page`, which the server answers with zero rows. Fall
      // back to the last page that still has rows rather than dumping someone
      // who was on page 7 back to page 1. `page - 1` bounds it so the value
      // strictly decreases even if the server reports a nonsense `last_page`,
      // which guarantees this converges instead of looping.
      if (rows.length === 0 && page > 1) {
        const lastPage = res.meta?.last_page ?? 1;
        clamping = true;
        goToPage(Math.max(1, Math.min(lastPage, page - 1)));
        return;
      }

      setLoans(rows);
    } catch {
      if (requestId === requestIdRef.current) {
        // The toast is transient; without an error state the table falls back to
        // its "No loan applications found." row, which tells the officer their
        // loans are gone.
        setError("We couldn't load the loans. Please try again.");
        toast.error("We couldn't load loans. Please try again.");
      }
    } finally {
      if (requestId === requestIdRef.current && !clamping) setLoading(false);
    }
  }, [
    page,
    perPage,
    sortKey,
    sortDir,
    statusParam,
    search,
    productId,
    dateFromParam,
    dateToParam,
    goToPage,
  ]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  // ── Products for the filter dropdown: load once ──
  useEffect(() => {
    let cancelled = false;
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
  // The URL is the single source of truth for the request, so debouncing the
  // write here is what keeps this to one request per settled search box rather
  // than one per keystroke.
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

  // ── Counts (KPI cards + tab badges) come from meta.stats, so they describe
  //    every loan in the coop — not just the page currently on screen. ──
  // `stats` is only ever replaced by a successful response, so once counts are
  // known they survive a later failure. Until then there is nothing to show and
  // the cards say so, instead of printing a zero the API never confirmed.
  const countsKnown = Object.keys(stats).length > 0;
  const allCount = allCountFromStats(stats);
  const activeCount = activeCountFromStats(stats);

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
            value={countsKnown ? allCount : null}
            valueClassName=""
            icon={<FileText className="h-5 w-5 text-brand-blue" />}
            iconBg="bg-brand-blue/10"
            active={tab === "all"}
            onClick={() => handleTabChange("all")}
          />
          <StatCard
            label="Pending Approval"
            value={countsKnown ? (stats.for_review ?? 0) : null}
            valueClassName="text-amber-600"
            icon={<Clock className="h-5 w-5 text-amber-600" />}
            iconBg="bg-amber-500/10"
            active={tab === "for_review"}
            onClick={() => handleTabChange("for_review")}
          />
          <StatCard
            label="Active Loans"
            value={countsKnown ? activeCount : null}
            valueClassName="text-green-600"
            icon={<Banknote className="h-5 w-5 text-green-600" />}
            iconBg="bg-green-500/10"
            active={tab === "active"}
            onClick={() => handleTabChange("active")}
          />
          <StatCard
            label="Rejected"
            value={countsKnown ? (stats.rejected ?? 0) : null}
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
                {!countsKnown
                  ? "—"
                  : t.value === "all"
                    ? allCount
                    : (stats[t.value] ?? 0)}
              </span>
            </button>
          ))}
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-medium">
              Loan Applications{countsKnown ? ` (${total})` : ""}
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
            ) : error ? (
              <div
                role="alert"
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <AlertTriangle className="h-8 w-8 text-destructive/60 mb-3" />
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchLoans}
                  className="mt-3 border-brand-orange/50 text-brand-orange hover:bg-brand-orange/5"
                >
                  Retry
                </Button>
              </div>
            ) : (
              <>
                <LoanTable
                  loans={loans}
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
                  page={page}
                  perPage={perPage}
                  total={total}
                  onPageChange={goToPage}
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
