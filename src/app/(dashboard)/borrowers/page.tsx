"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserCheck, UserX, AlertTriangle } from "lucide-react";
import type { Borrower, BorrowerStatus } from "@/types";
import { INITIAL_BORROWERS } from "./_components/mock-data";
import {
  BorrowerFilters,
  type StatusFilter,
} from "./_components/borrower-filters";
import { BorrowerTable } from "./_components/borrower-table";
import { AddBorrowerDialog } from "./_components/borrower-actions";

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<Borrower[]>(INITIAL_BORROWERS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
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
            borrowers={filteredBorrowers}
            onEdit={handleEdit}
            onToggleStatus={handleToggleStatus}
            onDelete={handleDelete}
          />
        </CardContent>
      </Card>
    </div>
  );
}
