"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RouteGuard, PermissionGate, TablePagination } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Borrower } from "@/types";
import { Spinner } from "@/components/ui/spinner";
import { borrowerService } from "@/services/borrower.service";
import {
  BorrowerFilters,
  type StatusFilter,
} from "./_components/borrower-filters";
import { BorrowerTable } from "./_components/borrower-table";
import { RegistrationsTab } from "./_components/registrations-tab";
import { useRegistrations } from "@/hooks/use-registrations";
import { cn } from "@/lib/utils";
import { usePublicBranches } from "@/hooks/use-public-branches";

/**
 * Global member counts, read from the list response's `meta.stats`.
 *
 * Members only. `pending` and `rejected` used to live here too, which is how
 * the Pending Registrations badge ended up counted by a different query than
 * the table it labels. Application counts now come from the application query
 * itself — see `pending` / `rejected` below.
 */
interface MemberStats {
  active: number;
  inactive: number;
  blacklisted: number;
}

/**
 * Summary card.
 *
 * `value` is null while no counts are known — a first load that failed, or one
 * that has not answered yet. It renders as an em dash rather than 0, matching
 * the loans page: "a zero here reads as 'this coop has no loans', which is a
 * statement of fact we are in no position to make." Same applies to members —
 * four zeros under a table that is simultaneously showing "we couldn't load
 * the members" told the admin their membership had been wiped.
 */
function StatCard({
  label,
  value,
  valueClassName,
  icon,
  iconBg,
}: {
  label: string;
  value: number | null;
  valueClassName?: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className={cn("text-2xl font-bold", valueClassName)}>
              {value ?? "—"}
            </p>
          </div>
          <div className={cn("rounded-full p-2.5", iconBg)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

type MainTab = "members" | "pending" | "rejected";

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [total, setTotal] = useState(0);
  // null, not zeroes: "we do not know yet" is a different thing from "none".
  const [stats, setStats] = useState<MemberStats | null>(null);
  const { branches } = usePublicBranches();
  const branchNameById = useMemo(
    () => new Map(branches.map((b) => [b.id, b.name])),
    [branches]
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Pagination state. The server does the slicing — these are request params,
  // not indexes into a local array.
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  const [mainTab, setMainTab] = useState<MainTab>("members");

  // ── Registrations (applications, not members) ──
  // One page size for both application tabs; a page cursor each.
  const [regPerPage, setRegPerPage] = useState(10);
  const [pendingPage, setPendingPage] = useState(1);
  const [rejectedPage, setRejectedPage] = useState(1);

  // Always live, even on the members tab: this one query feeds BOTH the tab
  // badge and the tab's table, so the badge is the count of exactly the rows
  // the table pages through — true by construction rather than by two server
  // queries happening to agree. It used to read `meta.stats.pending` from the
  // members request instead, and `meta.stats` is branch-scoped when a
  // `branch_id` filter is in play while this query is not, so the two were one
  // filter away from silently disagreeing.
  const pending = useRegistrations({
    status: "pending",
    page: pendingPage,
    per_page: regPerPage,
  });

  // Rejected applications are an archive, not a work queue: no badge needs
  // their count, so the query stays parked until the tab is actually opened.
  const rejected = useRegistrations({
    status: "rejected",
    page: rejectedPage,
    per_page: regPerPage,
    enabled: mainTab === "rejected",
  });

  // A second reviewer working the queue can shrink `total` under this cursor.
  // TablePagination clamps for DISPLAY only — it never calls back — so with,
  // say, page 3 of a queue that has dropped to 5 rows, both arrows compute to
  // disabled and the tab strands on an empty table it cannot leave. The members
  // list already solves this server-side in fetchBorrowers; these tabs snap the
  // cursor back during render instead (React's "adjusting state when a prop
  // changes"), which converges because `lastPage` is a fixed value from the
  // response rather than a function of the page we are correcting.
  if (!pending.loading && pendingPage > pending.lastPage) {
    setPendingPage(pending.lastPage);
  }
  if (!rejected.loading && mainTab === "rejected" && rejectedPage > rejected.lastPage) {
    setRejectedPage(rejected.lastPage);
  }

  // Search is a server query now, so wait for the admin to stop typing.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Guards against out-of-order responses: fast typing or rapid page clicks can
  // land an older request last and repaint the wrong rows.
  const requestIdRef = useRef(0);

  const fetchBorrowers = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    // When we clamp we immediately refetch, so `loading` must stay true through
    // the hand-off — otherwise `finally` clears it and React paints one frame of
    // the old rows under a pre-delete total.
    let clamping = false;
    try {
      setLoading(true);
      setError(null);
      // `members_only` drops pending + rejected applicants server-side — they
      // belong on the application tabs, not in the members list.
      const res = await borrowerService.list({
        members_only: 1,
        page: currentPage,
        per_page: rowsPerPage,
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      if (requestId !== requestIdRef.current) return;
      const rows = res.data ?? [];

      // Totals and counts are authoritative on every response, so apply them
      // before the clamp check — otherwise the page we are about to re-request
      // leaves the cards and the paginator showing pre-delete numbers.
      setTotal(res.meta?.total ?? rows.length);
      // Only ever replaced by a response that actually carries counts. An API
      // build that omits `stats` should leave the last known figures standing,
      // not zero them.
      const s = res.meta?.stats;
      if (s) {
        setStats({
          active: s.active ?? 0,
          inactive: s.inactive ?? 0,
          blacklisted: s.blacklisted ?? 0,
        });
      }

      // A bulk delete on the last page can leave `currentPage` past `last_page`,
      // which the server answers with zero rows. Fall back to the last page that
      // still has rows — dumping someone who deleted on page 7 back to page 1
      // loses their place. `currentPage - 1` bounds it so the value strictly
      // decreases even if the server reports a nonsense `last_page`, which
      // guarantees this converges instead of looping.
      if (rows.length === 0 && currentPage > 1) {
        const lastPage = res.meta?.last_page ?? 1;
        clamping = true;
        setCurrentPage(Math.max(1, Math.min(lastPage, currentPage - 1)));
        return;
      }

      setBorrowers(rows);
    } catch {
      if (requestId === requestIdRef.current) {
        // The toast is transient; without an error state the screen falls back
        // to the "No members yet" empty state, which tells the admin their
        // members are gone.
        setError("We couldn't load the members. Please try again.");
        toast.error("We couldn't load the borrowers. Please try again.");
      }
    } finally {
      if (requestId === requestIdRef.current && !clamping) setLoading(false);
    }
  }, [currentPage, rowsPerPage, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchBorrowers();
  }, [fetchBorrowers]);

  // `stats` counts every member in the database, so the tab counts stay stable
  // while paging or filtering — unlike `total`, which tracks the active filters.
  // null propagates: an unknown total must not render as 0.
  const memberCount = stats
    ? stats.active + stats.inactive + stats.blacklisted
    : null;
  const hasFilters = statusFilter !== "all" || debouncedSearch !== "";

  // Reset to page 1 when filters change
  function handleSearchChange(value: string) {
    setSearch(value);
    setCurrentPage(1);
  }

  function handleStatusFilterChange(value: StatusFilter) {
    setStatusFilter(value);
    setCurrentPage(1);
  }

  /**
   * Clearing resets search and status in ONE state update, so React batches it
   * into a single render and `fetchBorrowers` is rebuilt once — one request.
   *
   * `setDebouncedSearch("")` is the load-bearing line. Without it the status
   * reset lands immediately while the 300ms debounce still holds the old term,
   * so the first request reads "all statuses, still searching for X" — visibly
   * wrong rows — and a second request 300ms later corrects it. Writing the
   * debounced value directly skips the timer for a value we already know.
   */
  function handleClearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setCurrentPage(1);
  }

  function handleRowsPerPageChange(value: number) {
    setRowsPerPage(value);
    setCurrentPage(1);
  }

  // Page size is shared by both application tabs, so reset both cursors —
  // leaving one on page 9 under a new page size points it past the end.
  function handleRegPerPageChange(value: number) {
    setRegPerPage(value);
    setPendingPage(1);
    setRejectedPage(1);
  }

  const handleToggleStatus = async (id: number) => {
    const borrower = borrowers.find((b) => b.id === id);
    if (!borrower) return;

    try {
      if (borrower.status === "active") {
        await borrowerService.deactivate(id);
      } else {
        await borrowerService.reactivate(id);
      }
      toast.success(
        `Borrower ${borrower.status === "active" ? "deactivated" : "reactivated"}`
      );
      fetchBorrowers();
    } catch {
      toast.error("We couldn't update the borrower status. Please try again.");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await borrowerService.delete(id);
      toast.success("Borrower deleted");
      fetchBorrowers();
    } catch {
      toast.error("We couldn't delete the borrower. Please try again.");
    }
  };

  const handleBulkDeactivate = async (ids: number[]) => {
    try {
      await borrowerService.bulkDeactivate(ids);
      toast.success(`${ids.length} borrower(s) deactivated`);
      fetchBorrowers();
    } catch {
      toast.error("We couldn't deactivate some borrowers. Please try again.");
    }
  };

  const handleBulkDelete = async (ids: number[]) => {
    try {
      await borrowerService.bulkDelete(ids);
      toast.success(`${ids.length} borrower(s) deleted`);
      fetchBorrowers();
    } catch {
      toast.error("We couldn't delete some borrowers. Please try again.");
    }
  };

  const MAIN_TABS: {
    value: MainTab;
    label: string;
    badge?: number;
    /** Read after the number by a screen reader, so it is per-tab. */
    badgeLabel?: string;
  }[] = [
    { value: "members", label: "Active Members" },
    {
      value: "pending",
      label: "Pending Registrations",
      badge: pending.total,
      badgeLabel: "awaiting review",
    },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <RouteGuard permission="borrowers:view" pageName="Members">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Member Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Search, filter, and manage member profiles
          </p>
        </div>
        <PermissionGate permission="borrowers:create">
          <Link
            href="/borrowers/new"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-orange px-4 py-2 text-sm font-medium text-brand-orange-foreground hover:bg-brand-orange-dark transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Add Member
          </Link>
        </PermissionGate>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Total Members"
          value={memberCount}
          icon={<Users className="h-5 w-5 text-brand-blue" />}
          iconBg="bg-brand-blue/10"
        />
        <StatCard
          label="Active"
          value={stats?.active ?? null}
          valueClassName="text-green-600"
          icon={<UserCheck className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-500/10"
        />
        <StatCard
          label="Inactive"
          value={stats?.inactive ?? null}
          valueClassName="text-red-600"
          icon={<UserX className="h-5 w-5 text-red-600" />}
          iconBg="bg-red-500/10"
        />
        <StatCard
          label="Blacklisted"
          value={stats?.blacklisted ?? null}
          icon={<AlertTriangle className="h-5 w-5 text-muted-foreground" />}
          iconBg="bg-muted"
        />
      </div>

      {/* Main tab switcher */}
      <div
        className="flex border-b border-border"
        role="group"
        aria-label="Members and applications"
      >
        {MAIN_TABS.map((tab) => {
          const selected = mainTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={selected}
              id={`${tab.value}-tab`}
              aria-controls={`${tab.value}-panel`}
              onClick={() => setMainTab(tab.value)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40",
                selected
                  ? "border-brand-orange text-brand-orange"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold",
                    selected
                      ? "bg-brand-orange text-white"
                      : "bg-amber-100 text-amber-700"
                  )}
                >
                  {tab.badge}
                  {tab.badgeLabel ? (
                    <span className="sr-only"> {tab.badgeLabel}</span>
                  ) : null}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters + Table */}
      {mainTab === "members" && (
      <Card id="members-panel" role="region" aria-labelledby="members-tab">
        <div className="p-6 pb-0">
          <BorrowerFilters
            search={search}
            onSearchChange={handleSearchChange}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusFilterChange}
            onClearFilters={handleClearFilters}
            counts={{
              all: memberCount,
              active: stats?.active ?? null,
              inactive: stats?.inactive ?? null,
              blacklisted: stats?.blacklisted ?? null,
            }}
          />
        </div>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="size-6 text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive/60 mb-3" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <button
                onClick={fetchBorrowers}
                className="mt-3 inline-flex items-center rounded-md border border-brand-orange/50 px-3 py-1.5 text-xs font-semibold text-brand-orange hover:bg-brand-orange/5 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : borrowers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {hasFilters ? "No members match your filters" : "No members yet"}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {hasFilters
                  ? "Try a different search term or status tab."
                  : 'Click "Add Member" to create the first profile.'}
              </p>
            </div>
          ) : (
            <BorrowerTable
              borrowers={borrowers}
              branchNameById={branchNameById}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDelete}
              onBulkDeactivate={handleBulkDeactivate}
              onBulkDelete={handleBulkDelete}
            />
          )}

          <TablePagination
            page={currentPage}
            perPage={rowsPerPage}
            total={total}
            onPageChange={setCurrentPage}
            onPerPageChange={handleRowsPerPageChange}
          />
        </CardContent>
      </Card>
      )}

      {mainTab === "pending" && (
        <Card id="pending-panel" role="region" aria-labelledby="pending-tab">
          <CardContent className="pt-6">
            <RegistrationsTab
              status="pending"
              registrations={pending.registrations}
              total={pending.total}
              loading={pending.loading}
              error={pending.error}
              page={pendingPage}
              perPage={regPerPage}
              onPageChange={setPendingPage}
              onPerPageChange={handleRegPerPageChange}
              onRetry={pending.refresh}
              branchNameById={branchNameById}
            />
          </CardContent>
        </Card>
      )}

      {mainTab === "rejected" && (
        <Card id="rejected-panel" role="region" aria-labelledby="rejected-tab">
          <CardContent className="pt-6">
            <RegistrationsTab
              status="rejected"
              registrations={rejected.registrations}
              total={rejected.total}
              loading={rejected.loading}
              error={rejected.error}
              page={rejectedPage}
              perPage={regPerPage}
              onPageChange={setRejectedPage}
              onPerPageChange={handleRegPerPageChange}
              onRetry={rejected.refresh}
              branchNameById={branchNameById}
            />
          </CardContent>
        </Card>
      )}
    </div>
    </RouteGuard>
  );
}
