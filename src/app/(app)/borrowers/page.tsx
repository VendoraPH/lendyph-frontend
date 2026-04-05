"use client";

import { useState, useEffect, useCallback } from "react";
import { RouteGuard } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
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

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50] as const;

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

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

  // Counts for filter tabs
  const activeCount = borrowers.filter((b) => b.status === "active").length;
  const inactiveCount = borrowers.filter((b) => b.status === "inactive").length;
  const blacklistedCount = borrowers.filter(
    (b) => b.status === "blacklisted"
  ).length;

  // Filtering logic
  const filteredBorrowers = borrowers.filter((b) => {
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

  const handleEdit = async (updated: Borrower) => {
    try {
      await borrowerService.update(updated.id, updated);
      toast.success("Borrower updated successfully");
      fetchBorrowers();
    } catch {
      toast.error("Failed to update borrower");
    }
  };

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
      await Promise.all(ids.map((id) => borrowerService.deactivate(id)));
      toast.success(`${ids.length} borrower(s) deactivated`);
      fetchBorrowers();
    } catch {
      toast.error("Failed to deactivate some borrowers");
    }
  };

  const handleBulkDelete = async (ids: number[]) => {
    try {
      await Promise.all(ids.map((id) => borrowerService.delete(id)));
      toast.success(`${ids.length} borrower(s) deleted`);
      fetchBorrowers();
    } catch {
      toast.error("Failed to delete some borrowers");
    }
  };

  return (
    <RouteGuard permission="borrowers:view" pageName="Borrowers">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Borrower Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Search, filter, and manage borrower profiles
          </p>
        </div>
        <Link
          href="/borrowers/new"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-orange px-4 py-2 text-sm font-medium text-brand-orange-foreground hover:bg-brand-orange-dark transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Add Borrower
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Borrowers</p>
                <p className="text-2xl font-bold">{borrowers.length}</p>
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

      {/* Filters + Table */}
      <Card>
        <div className="p-6 pb-0">
          <BorrowerFilters
            search={search}
            onSearchChange={handleSearchChange}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusFilterChange}
            counts={{
              all: borrowers.length,
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
          ) : borrowers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No borrowers yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Click &quot;Add Borrower&quot; to create the first profile.
              </p>
            </div>
          ) : (
            <BorrowerTable
              borrowers={paginatedBorrowers}
              onEdit={handleEdit}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDelete}
              onBulkDeactivate={handleBulkDeactivate}
              onBulkDelete={handleBulkDelete}
            />
          )}

          {/* Pagination Controls */}
          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <Select
                value={String(rowsPerPage)}
                onValueChange={(val) => handleRowsPerPageChange(Number(val))}
              >
                <SelectTrigger size="sm" className="w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROWS_PER_PAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={String(opt)}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground tabular-nums">
                {totalResults > 0
                  ? `Showing ${startIndex + 1} to ${endIndex} of ${totalResults} results`
                  : "No results"}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.max(1, p - 1))
                  }
                  disabled={safeCurrentPage <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={safeCurrentPage >= totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </RouteGuard>
  );
}
