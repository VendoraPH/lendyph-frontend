"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
            return (
              <TableRow key={reg.id} className="hover:bg-muted/50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
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

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const { branches } = usePublicBranches();
  const branchNameById = useMemo(
    () => new Map(branches.map((b) => [b.id, b.name])),
    [branches]
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  type MainTab = "members" | "registrations";
  const [mainTab, setMainTab] = useState<MainTab>("members");
  const { total: pendingCount } = useRegistrations({ status: "pending" });

  const fetchBorrowers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await borrowerService.list();
      setBorrowers(Array.isArray(res) ? res : res.data ?? []);
    } catch {
      toast.error("Failed to load borrowers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBorrowers();
  }, [fetchBorrowers]);

  // Pending applicants belong on the Pending Registrations tab — they
  // must not leak into the Members list or its "All" count.
  const members = useMemo(
    () => borrowers.filter((b) => b.status !== "pending"),
    [borrowers]
  );

  // Counts for filter tabs
  const activeCount = members.filter((b) => b.status === "active").length;
  const inactiveCount = members.filter((b) => b.status === "inactive").length;
  const blacklistedCount = members.filter(
    (b) => b.status === "blacklisted"
  ).length;

  // Filtering logic
  const filteredBorrowers = members.filter((b) => {
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        b.full_name.toLowerCase().includes(q) ||
        b.borrower_code.toLowerCase().includes(q) ||
        (b.contact_number ?? "").includes(q) ||
        (b.email ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Pagination logic (applied after filtering)
  const totalResults = filteredBorrowers.length;
  const totalPages = Math.ceil(totalResults / rowsPerPage);
  const safeCurrentPage = Math.min(currentPage, Math.max(totalPages, 1));
  const startIndex = (safeCurrentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalResults);
  const paginatedBorrowers = filteredBorrowers.slice(startIndex, endIndex);

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
        `Borrower ${borrower.status === "active" ? "deactivated" : "reactivated"} successfully`
      );
      fetchBorrowers();
    } catch {
      toast.error("Failed to update borrower status");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await borrowerService.delete(id);
      toast.success("Borrower deleted successfully");
      fetchBorrowers();
    } catch {
      toast.error("Failed to delete borrower");
    }
  };

  const handleBulkDeactivate = async (ids: number[]) => {
    try {
      await borrowerService.bulkDeactivate(ids);
      toast.success(`${ids.length} borrower(s) deactivated`);
      fetchBorrowers();
    } catch {
      toast.error("Failed to deactivate some borrowers");
    }
  };

  const handleBulkDelete = async (ids: number[]) => {
    try {
      await borrowerService.bulkDelete(ids);
      toast.success(`${ids.length} borrower(s) deleted`);
      fetchBorrowers();
    } catch {
      toast.error("Failed to delete some borrowers");
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
                <p className="text-2xl font-bold">{members.length}</p>
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
                  {activeCount}
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
                  {inactiveCount}
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
                <p className="text-2xl font-bold">{blacklistedCount}</p>
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
              all: members.length,
              active: activeCount,
              inactive: inactiveCount,
              blacklisted: blacklistedCount,
            }}
          />
        </div>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="size-6 text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No members yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Click &quot;Add Member&quot; to create the first profile.
              </p>
            </div>
          ) : (
            <BorrowerTable
              borrowers={paginatedBorrowers}
              branchNameById={branchNameById}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDelete}
              onBulkDeactivate={handleBulkDeactivate}
              onBulkDelete={handleBulkDelete}
            />
          )}

          <TablePagination
            page={safeCurrentPage}
            perPage={rowsPerPage}
            total={totalResults}
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
