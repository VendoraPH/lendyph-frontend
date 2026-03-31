"use client";

import { useState } from "react";
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
  UserCheck,
  UserX,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Borrower, BorrowerStatus } from "@/types";
import { INITIAL_BORROWERS } from "./_components/mock-data";
import {
  BorrowerFilters,
  type StatusFilter,
} from "./_components/borrower-filters";
import { BorrowerTable } from "./_components/borrower-table";
import { AddBorrowerDialog } from "./_components/borrower-actions";

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50] as const;

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<Borrower[]>(INITIAL_BORROWERS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

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
        b.phone.includes(q)
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

  const handleAdd = (newBorrower: Borrower) => {
    setBorrowers((prev) => [newBorrower, ...prev]);
  };

  const handleEdit = (updated: Borrower) => {
    setBorrowers((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b))
    );
  };

  const handleToggleStatus = (id: number) => {
    setBorrowers((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              status: (b.status === "active"
                ? "inactive"
                : "active") as BorrowerStatus,
            }
          : b
      )
    );
  };

  const handleDelete = (id: number) => {
    setBorrowers((prev) => prev.filter((b) => b.id !== id));
  };

  const handleBulkDeactivate = (ids: number[]) => {
    setBorrowers((prev) =>
      prev.map((b) =>
        ids.includes(b.id) ? { ...b, status: "inactive" as BorrowerStatus } : b
      )
    );
  };

  const handleBulkDelete = (ids: number[]) => {
    setBorrowers((prev) => prev.filter((b) => !ids.includes(b.id)));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Borrower Management
          </h1>
          <p className="text-muted-foreground">
            Search, filter, and manage borrower profiles
          </p>
        </div>
        <AddBorrowerDialog onAdd={handleAdd} borrowerCount={borrowers.length} />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Borrowers</p>
                <p className="text-2xl font-bold">{borrowers.length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {activeCount}
                </p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Inactive</p>
                <p className="text-2xl font-bold text-red-600">
                  {inactiveCount}
                </p>
              </div>
              <UserX className="h-8 w-8 text-red-600/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Blacklisted</p>
                <p className="text-2xl font-bold">{blacklistedCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-muted-foreground/30" />
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
          <BorrowerTable
            borrowers={paginatedBorrowers}
            onEdit={handleEdit}
            onToggleStatus={handleToggleStatus}
            onDelete={handleDelete}
            onBulkDeactivate={handleBulkDeactivate}
            onBulkDelete={handleBulkDelete}
          />

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
  );
}
