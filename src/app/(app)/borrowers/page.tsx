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
  ClipboardList,
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
import { useRegistrations } from "@/hooks/use-registrations";
import type { Registration } from "@/services/registration.service";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fileUrl } from "@/lib/file-url";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, getInitials, statusBadgeColor } from "./_components/utils";
import { usePublicBranches } from "@/hooks/use-public-branches";

function PendingRegistrationsTab() {
  const { registrations, loading, error } = useRegistrations({ status: "pending" });
  const { branches } = usePublicBranches();
  const branchNameById = useMemo(
    () => new Map(branches.map((b) => [b.id, b.name])),
    [branches]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive/60 mb-3" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (registrations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No pending registrations</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          New applications will appear here for review.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right">Income</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {registrations.map((reg: Registration) => {
            const fullName = [reg.first_name, reg.middle_name, reg.last_name]
              .filter(Boolean)
              .join(" ");
            const branchName =
              reg.branch_id != null ? branchNameById.get(reg.branch_id) : undefined;
            const photoSrc = fileUrl(reg.photo_url ?? reg.photo);
            return (
              <TableRow key={reg.id} className="hover:bg-muted/50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      {photoSrc ? (
                        <AvatarImage src={photoSrc} alt={fullName} />
                      ) : null}
                      <AvatarFallback className="bg-brand-orange/10 text-brand-orange text-xs font-semibold">
                        {getInitials(fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{fullName}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        PEND-{String(reg.id).padStart(4, "0")}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {reg.contact_number || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {branchName || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {reg.email || "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-brand-orange font-medium">
                  {reg.monthly_income
                    ? formatCurrency(Number(reg.monthly_income))
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusBadgeColor.pending}>
                    pending
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/borrowers/registrations/${reg.id}`}
                    className="inline-flex items-center rounded-md border border-brand-orange/50 px-3 py-1.5 text-xs font-semibold text-brand-orange hover:bg-brand-orange/5 transition-colors"
                  >
                    Review
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** Global per-status member counts, read from the list response's `meta.stats`. */
interface MemberStats {
  active: number;
  inactive: number;
  blacklisted: number;
  pending: number;
}

const EMPTY_STATS: MemberStats = {
  active: 0,
  inactive: 0,
  blacklisted: 0,
  pending: 0,
};

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<MemberStats>(EMPTY_STATS);
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

  type MainTab = "members" | "registrations";
  const [mainTab, setMainTab] = useState<MainTab>("members");

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
      // belong on the Pending Registrations tab, not in the members list.
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
      const s = res.meta?.stats;
      setStats({
        active: s?.active ?? 0,
        inactive: s?.inactive ?? 0,
        blacklisted: s?.blacklisted ?? 0,
        pending: s?.pending ?? 0,
      });

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
  const memberCount = stats.active + stats.inactive + stats.blacklisted;
  const pendingCount = stats.pending;
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

  function handleRowsPerPageChange(value: number) {
    setRowsPerPage(value);
    setCurrentPage(1);
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
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold">{memberCount}</p>
              </div>
              <div className="rounded-full bg-brand-blue/10 p-2.5">
                <Users className="h-5 w-5 text-brand-blue" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.active}
                </p>
              </div>
              <div className="rounded-full bg-green-500/10 p-2.5">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Inactive</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.inactive}
                </p>
              </div>
              <div className="rounded-full bg-red-500/10 p-2.5">
                <UserX className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Blacklisted</p>
                <p className="text-2xl font-bold">{stats.blacklisted}</p>
              </div>
              <div className="rounded-full bg-muted p-2.5">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main tab switcher */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setMainTab("members")}
          className={cn(
            "px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors",
            mainTab === "members"
              ? "border-brand-orange text-brand-orange"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Active Members
        </button>
        <button
          onClick={() => setMainTab("registrations")}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors",
            mainTab === "registrations"
              ? "border-brand-orange text-brand-orange"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Pending Registrations
          {pendingCount > 0 && (
            <span className={cn(
              "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold",
              mainTab === "registrations"
                ? "bg-brand-orange text-white"
                : "bg-amber-100 text-amber-700"
            )}>
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters + Table */}
      {mainTab === "members" && (
      <Card>
        <div className="p-6 pb-0">
          <BorrowerFilters
            search={search}
            onSearchChange={handleSearchChange}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusFilterChange}
            counts={{
              all: memberCount,
              active: stats.active,
              inactive: stats.inactive,
              blacklisted: stats.blacklisted,
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

      {mainTab === "registrations" && (
        <Card>
          <CardContent className="pt-0">
            <PendingRegistrationsTab />
          </CardContent>
        </Card>
      )}
    </div>
    </RouteGuard>
  );
}
